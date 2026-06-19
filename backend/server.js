require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const sepay = require('./sepay');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── XÁC THỰC MÃ BẢN QUYỀN CHO DESKTOP APP (Không cần Đăng nhập) ──────────────
app.post('/api/verify-license', async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.json({ valid: false, message: 'Mã bản quyền trống' });
  }

  try {
    const keyRecord = await db.dbGet(`
      SELECT k.*, p.name as product_name 
      FROM keys k 
      LEFT JOIN products p ON k.product_id = p.id 
      WHERE k.key_value = ?
    `, [key]);
    
    if (!keyRecord) {
      return res.json({ valid: false, message: 'Mã bản quyền không tồn tại' });
    }

    if (keyRecord.status !== 'active') {
      return res.json({ valid: false, message: `Mã bản quyền ở trạng thái: ${keyRecord.status}` });
    }

    if (keyRecord.expires_at) {
      const expiryDate = new Date(keyRecord.expires_at);
      if (expiryDate < new Date()) {
        await db.dbRun("UPDATE keys SET status = 'expired' WHERE id = ?", [keyRecord.id]);
        return res.json({ valid: false, message: 'Mã bản quyền đã hết hạn sử dụng' });
      }
    }

    res.json({
      valid: true,
      product_name: keyRecord.product_name || 'AIO Media Scraper',
      expires_at: keyRecord.expires_at ? new Date(keyRecord.expires_at).toLocaleDateString('vi-VN') : 'Lifetime'
    });
  } catch (err) {
    res.json({ valid: false, message: `Lỗi máy chủ xác thực: ${err.message}` });
  }
});

// ── ĐĂNG NHẬP GOOGLE ────────────────────────────────────────────────────────
app.post('/api/auth/google', auth.handleGoogleLogin);
app.get('/api/auth/google/client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// ── TÀI KHOẢN NGƯỜI DÙNG (Yêu cầu Token) ────────────────────────────────────
app.get('/api/user/info', auth.verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get('/api/user/keys', auth.verifyToken, async (req, res) => {
  try {
    const keys = await db.dbAll(`
      SELECT k.*, p.name as product_name, p.download_url as product_download_url
      FROM keys k 
      LEFT JOIN products p ON k.product_id = p.id 
      WHERE k.user_id = ? 
      ORDER BY k.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user/transactions', auth.verifyToken, async (req, res) => {
  try {
    const transactions = await db.dbAll(`
      SELECT t.*, p.name as product_name 
      FROM transactions t 
      LEFT JOIN products p ON t.product_id = p.id 
      WHERE t.user_id = ? 
      ORDER BY t.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TẠO YÊU CẦU MUA KEY (Đơn hàng chờ thanh toán) ───────────────────────────
app.post('/api/buy-key', auth.verifyToken, async (req, res) => {
  const { productId, packageType } = req.body;
  if (!productId || !packageType) {
    return res.status(400).json({ error: 'Thiếu thông tin sản phẩm hoặc gói mua.' });
  }

  try {
    const product = await db.dbGet('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Sản phẩm không tồn tại.' });
    }

    let amount = 0;
    if (packageType === '30_days') {
      amount = product.price_30_days;
    } else if (packageType === '180_days') {
      amount = product.price_180_days;
    } else if (packageType === '365_days') {
      amount = product.price_365_days;
    } else {
      return res.status(400).json({ error: 'Gói bản quyền không hợp lệ.' });
    }

    // Sinh mã memo code duy nhất: AIO + 5 chữ số ngẫu nhiên (ví dụ AIO49204)
    const memoCode = `AIO${Math.floor(10000 + Math.random() * 90000)}`;
    const transactionId = `TXN_${Date.now()}`;
    
    await db.dbRun(
      'INSERT INTO transactions (id, user_id, amount, memo_code, status, product_id, package_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [transactionId, req.user.id, amount, memoCode, 'pending', productId, packageType]
    );

    // Cấu hình ngân hàng VietQR
    const bankId = process.env.BANK_ID || 'MB';
    const bankAccount = process.env.BANK_ACCOUNT || '1234567890';
    const bankAccountName = process.env.BANK_ACCOUNT_NAME || 'AIO Scraper Owner';
    
    // Tạo link QR thanh toán tự động qua SePay (chuẩn VietQR)
    const qrUrl = `https://qr.sepay.vn/img?bank=${bankId}&acc=${bankAccount}&template=compact&amount=${amount}&des=${memoCode}&showinfo=true&holder=${encodeURIComponent(bankAccountName)}`;

    res.json({
      success: true,
      transactionId,
      amount,
      memoCode,
      qrUrl,
      bankId,
      bankAccount,
      bankAccountName,
      productName: product.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WEBHOOK SEPAY NHẬN THANH TOÁN TỰ ĐỘNG ────────────────────────────────────
app.post('/api/sepay-webhook', sepay.handleSepayWebhook);

// ── KHU VỰC ADMIN (Yêu cầu quyền Admin) ──────────────────────────────────────
app.get('/api/admin/users', auth.verifyAdmin, async (req, res) => {
  try {
    const users = await db.dbAll('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/keys', auth.verifyAdmin, async (req, res) => {
  try {
    const keys = await db.dbAll(`
      SELECT k.*, u.email as user_email, u.name as user_name, p.name as product_name
      FROM keys k 
      LEFT JOIN users u ON k.user_id = u.id 
      LEFT JOIN products p ON k.product_id = p.id
      ORDER BY k.created_at DESC
    `);
    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/transactions', auth.verifyAdmin, async (req, res) => {
  try {
    const transactions = await db.dbAll(`
      SELECT t.*, u.email as user_email, u.name as user_name, p.name as product_name
      FROM transactions t 
      LEFT JOIN users u ON t.user_id = u.id 
      LEFT JOIN products p ON t.product_id = p.id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/generate-key', auth.verifyAdmin, async (req, res) => {
  const { userId, type, durationDays, productId } = req.body;
  
  try {
    const newKey = sepay.generateKeyString();
    let expiresAt = null;
    if (type !== 'lifetime' && durationDays) {
      expiresAt = new Date(Date.now() + parseInt(durationDays) * 24 * 60 * 60 * 1000).toISOString();
    }

    await db.dbRun(
      'INSERT INTO keys (key_value, user_id, type, status, expires_at, product_id) VALUES (?, ?, ?, ?, ?, ?)',
      [newKey, userId || null, type, 'active', expiresAt, productId || 1]
    );

    res.json({ success: true, key: newKey, message: 'Đã tạo key thủ công thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/keys/:id', auth.verifyAdmin, async (req, res) => {
  try {
    await db.dbRun('DELETE FROM keys WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Đã xóa key thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── QUẢN LÝ SẢN PHẨM / TOOL BÁN HÀNG ──────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.dbAll('SELECT * FROM products ORDER BY id ASC');
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/products', auth.verifyAdmin, async (req, res) => {
  try {
    const products = await db.dbAll('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/products', auth.verifyAdmin, async (req, res) => {
  const { name, description, price_30_days, price_180_days, price_365_days, image_url, download_url } = req.body;
  if (!name || isNaN(price_30_days) || isNaN(price_180_days) || isNaN(price_365_days)) {
    return res.status(400).json({ error: 'Thông tin sản phẩm hoặc giá bán không hợp lệ.' });
  }

  try {
    await db.dbRun(`
      INSERT INTO products (name, description, price_30_days, price_180_days, price_365_days, image_url, download_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, description, price_30_days, price_180_days, price_365_days, image_url || null, download_url || null]);
    
    res.json({ success: true, message: 'Đã thêm sản phẩm mới thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/products/:id', auth.verifyAdmin, async (req, res) => {
  const { name, description, price_30_days, price_180_days, price_365_days, image_url, download_url } = req.body;
  if (!name || isNaN(price_30_days) || isNaN(price_180_days) || isNaN(price_365_days)) {
    return res.status(400).json({ error: 'Thông tin sản phẩm hoặc giá bán không hợp lệ.' });
  }

  try {
    await db.dbRun(`
      UPDATE products 
      SET name = ?, description = ?, price_30_days = ?, price_180_days = ?, price_365_days = ?, image_url = ?, download_url = ?
      WHERE id = ?
    `, [name, description, price_30_days, price_180_days, price_365_days, image_url || null, download_url || null, req.params.id]);
    
    res.json({ success: true, message: 'Đã cập nhật sản phẩm thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/products/:id', auth.verifyAdmin, async (req, res) => {
  if (req.params.id == 1) {
    return res.status(400).json({ error: 'Không thể xóa sản phẩm mặc định đầu tiên.' });
  }
  try {
    await db.dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Đã xóa sản phẩm thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Phục vụ giao diện HTML cho các trang con
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Khởi chạy server và khởi tạo DB
const startServer = async () => {
  await db.initDatabase();
  
  // Quét định kỳ các giao dịch chờ thanh toán (pending) quá 30 phút và đánh dấu thất bại
  setInterval(async () => {
    try {
      const sqlQuery = db.isPostgres
        ? `UPDATE transactions 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE status = 'pending' 
             AND created_at < NOW() - INTERVAL '30 minutes'`
        : `UPDATE transactions 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE status = 'pending' 
             AND datetime(created_at) < datetime('now', '-30 minutes')`;

      const result = await db.dbRun(sqlQuery);
      if (result && result.changes > 0) {
        console.log(`[Transaction Monitor]: Auto-expired ${result.changes} pending transaction(s) older than 30 minutes.`);
      }
    } catch (err) {
      console.error('[Transaction Monitor] Error updating expired transactions:', err);
    }
  }, 60000); // Chạy quét 1 phút một lần

  app.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`🚀 Website Bán Key đang hoạt động tại http://localhost:${PORT}`);
    console.log(`======================================================`);
  });
};

startServer();

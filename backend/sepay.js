const crypto = require('crypto');
const db = require('./db');

function generateKeyString() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `AIO-KEY-${segment()}-${segment()}-${segment()}-${segment()}`;
}

async function handleSepayWebhook(req, res) {
  const webhookKey = process.env.SEPAY_WEBHOOK_KEY;
  if (webhookKey) {
    const signature = req.headers['x-sepay-signature'] || '';
    const timestamp = req.headers['x-sepay-timestamp'] || '';
    const payload = JSON.stringify(req.body);

    const expected = 'sha256=' + crypto.createHmac('sha256', webhookKey)
      .update(timestamp + '.' + payload)
      .digest('hex');

    if (signature !== expected) {
      console.warn('[Sepay Webhook]: Xác thực chữ ký HMAC-SHA256 thất bại!');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const { id: sepayId, content, transferAmount, code, transferType } = req.body;

  if (transferType !== 'in') {
    return res.json({ success: true, message: 'Bỏ qua giao dịch rút tiền.' });
  }

  try {
    console.log(`[Sepay Webhook]: Nhận giao dịch mới: ID=${sepayId}, Số tiền=${transferAmount}, Nội dung="${content}", Code="${code}"`);

    let memoCode = code || '';
    if (!memoCode) {
      const match = content.match(/AIO\d+/i);
      if (match) {
        memoCode = match[0].toUpperCase();
      }
    }

    if (!memoCode) {
      console.warn('[Sepay Webhook]: Không tìm thấy mã giao dịch dạng AIOxxxxx trong nội dung chuyển khoản.');
      return res.json({ success: false, error: 'Không tìm thấy mã nội dung chuyển khoản' });
    }

    const transaction = await db.dbGet('SELECT * FROM transactions WHERE memo_code = ?', [memoCode]);

    if (!transaction) {
      console.warn(`[Sepay Webhook]: Mã giao dịch "${memoCode}" không khớp với bất kỳ yêu cầu thanh toán nào trong database.`);
      return res.json({ success: false, error: 'Mã giao dịch không tồn tại' });
    }

    if (transaction.status === 'completed') {
      console.log(`[Sepay Webhook]: Giao dịch "${memoCode}" đã được xử lý trước đó.`);
      return res.json({ success: true, message: 'Giao dịch đã được xử lý trước đó.' });
    }

    await db.dbRun(
      'UPDATE transactions SET status = ?, id = ?, updated_at = CURRENT_TIMESTAMP WHERE memo_code = ?',
      ['completed', sepayId || `SEPAY_${Date.now()}`, memoCode]
    );

    // Use the product_id and package_type stored in the transaction
    const type = transaction.package_type || '30_days';
    const productId = transaction.product_id || 1;
    
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (type === '365_days') {
      durationMs = 365 * 24 * 60 * 60 * 1000;
    } else if (type === '180_days') {
      durationMs = 180 * 24 * 60 * 60 * 1000;
    } else if (type === '90_days') {
      durationMs = 90 * 24 * 60 * 60 * 1000;
    } else if (type === 'lifetime') {
      durationMs = null;
    }

    const expiresAt = durationMs ? new Date(Date.now() + durationMs).toISOString() : null;
    const newKey = generateKeyString();

    await db.dbRun(
      'INSERT INTO keys (key_value, user_id, type, status, expires_at, product_id) VALUES (?, ?, ?, ?, ?, ?)',
      [newKey, transaction.user_id, type, 'active', expiresAt, productId]
    );

    console.log(`[Sepay Webhook SUCCESS]: Đã tạo Key mới "${newKey}" (${type}) cho người dùng ID=${transaction.user_id}`);
    res.json({ success: true, message: 'Xử lý webhook thành công, đã sinh key.' });
  } catch (err) {
    console.error('[Sepay Webhook Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  handleSepayWebhook,
  generateKeyString
};

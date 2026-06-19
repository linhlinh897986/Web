const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'aio-secret-key-12345';

async function handleGoogleLogin(req, res) {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Thiếu Google ID Token.' });
  }

  try {
    // Gọi API của Google để xác thực ID Token
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const response = await axios.get(verifyUrl);
    const payload = response.data;

    if (!payload.email) {
      return res.status(400).json({ error: 'Không thể lấy thông tin email từ Google.' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Kiểm tra xem user đã tồn tại chưa
    let user = await db.dbGet('SELECT * FROM users WHERE id = ?', [googleId]);

    // Kiểm tra cấu hình email admin từ .env
    const adminEmail = process.env.ADMIN_EMAIL || '';
    const isFirstUser = (await db.dbGet('SELECT COUNT(*) as count FROM users')).count === 0;
    const role = (email === adminEmail || isFirstUser) ? 'admin' : 'user';

    if (!user) {
      // Đăng ký mới
      await db.dbRun(
        'INSERT INTO users (id, email, name, picture, role) VALUES (?, ?, ?, ?, ?)',
        [googleId, email, name, picture, role]
      );
      user = { id: googleId, email, name, picture, role };
      console.log(`[Google Auth]: Đăng ký người dùng mới thành công: ${email} (${role})`);
    } else {
      // Cập nhật thông tin mới (nếu có thay đổi)
      await db.dbRun(
        'UPDATE users SET name = ?, picture = ? WHERE id = ?',
        [name, picture, googleId]
      );
      user.name = name;
      user.picture = picture;
    }

    // Tạo JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error('[Google Auth Error]:', err.message);
    res.status(401).json({ error: 'Xác thực Google ID Token thất bại.' });
  }
}

// Middleware xác thực JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
    }
    req.user = decoded;
    next();
  });
}

// Middleware xác thực quyền Admin
function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin.' });
    }
  });
}

module.exports = {
  handleGoogleLogin,
  verifyToken,
  verifyAdmin
};

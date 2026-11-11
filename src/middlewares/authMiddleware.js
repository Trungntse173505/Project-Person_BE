const jwt = require('jsonwebtoken');

/**
 * Middleware bảo vệ các route dành riêng cho Admin.
 * Hỗ trợ đồng thời 2 cơ chế (Hybrid):
 * 1. HttpOnly Cookie: `admin_token`
 * 2. Header: `Authorization: Bearer <token>` (Dự phòng trường hợp trình duyệt chặn Third-party Cookie chéo domain giữa FE & BE)
 */
const verifyAdminToken = (req, res, next) => {
  try {
    let token = req.cookies?.admin_token;

    // Nếu không có cookie, kiểm tra xem có Bearer token trong header không
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Truy cập bị từ chối. Vui lòng đăng nhập quyền Quản trị viên.',
      });
    }

    const jwtSecret =
      process.env.JWT_SECRET ||
      'super_secret_jwt_key_change_this_in_production_2026';

    const decoded = jwt.verify(token, jwtSecret);

    req.admin = {
      id: decoded.id,
      username: decoded.username,
    };

    return next();
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

    res.clearCookie('admin_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });

    return res.status(401).json({
      success: false,
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
    });
  }
};

module.exports = {
  verifyAdminToken,
};


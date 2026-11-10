const jwt = require('jsonwebtoken');

/**
 * Middleware bảo vệ các route dành riêng cho Admin.
 * Đọc JWT từ HttpOnly Cookie (không thể bị đánh cắp qua F12 Console / XSS).
 */
const verifyAdminToken = (req, res, next) => {
  try {
    const token = req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Truy cập bị từ chối. Vui lòng đăng nhập quyền Quản trị viên.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Gắn thông tin admin vào request để sử dụng ở controller tiếp theo
    req.admin = {
      id: decoded.id,
      username: decoded.username,
    };

    return next();
  } catch (error) {
    // Nếu token hết hạn hoặc bị chỉnh sửa giả mạo -> xóa luôn cookie rác
    res.clearCookie('admin_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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


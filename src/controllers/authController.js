const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Cấu hình chuẩn cho HttpOnly Cookie bảo mật
const getCookieOptions = () => {
  // Khi ở production hoặc đang chạy trên Vercel Serverless
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return {
    httpOnly: true, // Chặn tuyệt đối JS ở trình duyệt đọc cookie
    secure: isProd, // Bắt buộc HTTPS khi lên production/Vercel
    sameSite: isProd ? 'none' : 'lax', // Hỗ trợ cross-domain giữa FE và BE
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    path: '/',
  };
};

/**
 * POST /api/auth/login
 * Đăng nhập tài khoản Admin duy nhất
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Validate chặt chẽ kiểu dữ liệu và độ dài để tránh payload bất thường
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password ||
      username.length > 50 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu hợp lệ.',
      });
    }

    const cleanUsername = username.trim();

    // 2. Truy vấn user từ bảng users trên Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error) {
      console.error('[Auth Login DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Lỗi hệ thống khi xác thực. Vui lòng thử lại sau.',
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }
    const jwtSecret =
      process.env.JWT_SECRET ||
      'super_secret_jwt_key_change_this_in_production_2026';
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
      { id: user.id, username: user.username },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );
    res.cookie('admin_token', token, getCookieOptions());
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        id: user.id,
        username: user.username,
        token, // Trả kèm token để Frontend có thể gửi qua Header Authorization phòng trường hợp trình duyệt chặn cookie chéo domain
      },
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * POST /api/auth/logout
 * Đăng xuất và xóa HttpOnly Cookie
 */
const logout = (req, res) => {
  const { maxAge, ...clearOptions } = getCookieOptions();
  res.clearCookie('admin_token', clearOptions);

  return res.status(200).json({
    success: true,
    message: 'Đã đăng xuất thành công.',
  });
};

/**
 * GET /api/auth/me
 * Kiểm tra trạng thái phiên đăng nhập hiện tại của Admin
 */
const getMe = async (req, res) => {
  try {
    // Đã đi qua middleware verifyAdminToken nên có sẵn req.admin
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, created_at')
      .eq('id', req.admin.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không còn tồn tại.',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error('[Auth GetMe Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ nội bộ.',
    });
  }
};

module.exports = {
  login,
  logout,
  getMe,
};


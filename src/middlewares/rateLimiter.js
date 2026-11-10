const rateLimit = require('express-rate-limit');

// 1. Giới hạn chung cho toàn bộ API (Chống spam F12 / DDoS nhẹ / cào dữ liệu)
// Cho phép tối đa 100 request trong 15 phút trên mỗi IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100,
  standardHeaders: true, // Trả về thông tin rate limit trong header `RateLimit-*`
  legacyHeaders: false, // Tắt header `X-RateLimit-*` cũ
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ IP của bạn, vui lòng thử lại sau 15 phút.',
  },
});

// 2. Giới hạn cực kỳ nghiêm ngặt cho API Đăng nhập (Chống Brute-force dò mật khẩu)
// Chỉ cho phép thử sai tối đa 5 lần trong 15 phút trên mỗi IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5,
  skipSuccessfulRequests: true, // Nếu đăng nhập thành công thì không tính vào bộ đếm phạt
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút sau để thử lại.',
  },
});

module.exports = {
  apiLimiter,
  loginLimiter,
};


const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/authController');
const { verifyAdminToken } = require('../middlewares/authMiddleware');
const { loginLimiter } = require('../middlewares/rateLimiter');

// POST /api/auth/login - Áp dụng rate limit chống brute-force mật khẩu
router.post('/login', loginLimiter, login);

// POST /api/auth/logout - Xóa HttpOnly Cookie
router.post('/logout', logout);

// GET /api/auth/me - Kiểm tra phiên đăng nhập Admin
router.get('/me', verifyAdminToken, getMe);

module.exports = router;


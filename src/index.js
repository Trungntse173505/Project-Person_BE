require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { apiLimiter } = require('./middlewares/rateLimiter');
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const postRoutes = require('./routes/postRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Trust proxy nếu sau này deploy lên Render / Railway / Vercel / Nginx
// Giúp express-rate-limit lấy đúng IP thật của client thay vì IP của proxy
app.set('trust proxy', 1);

// 2. Bảo mật HTTP Headers bằng Helmet & ẩn hoàn toàn dấu vết X-Powered-By: Express
app.use(helmet());
app.disable('x-powered-by');

// 3. Khóa chặt CORS: Hỗ trợ domain Frontend chỉ định và tự động cho phép các link preview trên Vercel (*.vercel.app)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (như server-to-server của Next.js SSR, cURL, health check)
      if (!origin) {
        return callback(null, true);
      }

      // Cho phép nếu nằm trong danh sách CLIENT_URL cấu hình
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Tự động cho phép các sub-domain deploy preview của Vercel (*.vercel.app)
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith('.vercel.app')) {
          return callback(null, true);
        }
      } catch {
        // Bỏ qua lỗi parse URL
      }

      return callback(new Error('Bị chặn bởi chính sách bảo mật CORS.'));
    },
    credentials: true, // Bắt buộc để trình duyệt đính kèm HttpOnly Cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 4. Giới hạn kích thước JSON body (1mb đủ thoải mái cho bài viết Markdown dài nhưng vẫn chặn DoS payload lớn)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// 5. Áp dụng Rate Limit chung cho toàn bộ đường dẫn /api (Chống spam F12 / cào dữ liệu)
app.use('/api', apiLimiter);

// 6. Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Personal Knowledge Blog API is running securely.',
  });
});

// 7. Đăng ký các Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);

// 8. Xử lý Route không tồn tại (404) - Không lộ cấu trúc thư mục
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Đường dẫn API không tồn tại.',
  });
});

// 9. Global Error Handler - Tuyệt đối không trả stack trace lỗi ra ngoài ở môi trường production
app.use((err, req, res, next) => {
  if (err.message === 'Bị chặn bởi chính sách bảo mật CORS.') {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  console.error('[Unhandled Server Error]:', err.message);
  return res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi không xác định trên máy chủ.',
  });
});

// 10. Chạy server ở môi trường local hoặc xuất app cho Vercel Serverless Function
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Server BE đang chạy an toàn tại http://localhost:${PORT}`);
  });
}

module.exports = app;


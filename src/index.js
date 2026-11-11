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

app.set('trust proxy', 1);

app.use(helmet());
app.disable('x-powered-by');

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3000',
  'https://blog-useful.vercel.app',
  ...configuredOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith('.vercel.app')) {
          return callback(null, true);
        }
      } catch {
      }

      return callback(new Error('Bị chặn bởi chính sách bảo mật CORS.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/api', apiLimiter);
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Personal Knowledge Blog API is running securely.',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Đường dẫn API không tồn tại.',
  });
});

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


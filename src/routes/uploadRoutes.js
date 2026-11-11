const express = require('express');
const multer = require('multer');
const router = express.Router();
const { uploadImage } = require('../controllers/uploadController');
const { verifyAdminToken } = require('../middlewares/authMiddleware');

// Chỉ cho phép các định dạng ảnh an toàn (Chống upload file thực thi hoặc SVG chứa mã độc XSS)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(), // Lưu trên RAM, không ghi file rác ra ổ cứng server
  limits: {
    fileSize: 4 * 1024 * 1024, // Giới hạn tối đa 4MB (phù hợp với giới hạn 4.5MB của Vercel Serverless Function)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ hỗ trợ định dạng ảnh JPG, PNG, WEBP hoặc GIF (tối đa 4MB).'));
    }
  },
});

// POST /api/upload - Bắt buộc phải là Admin mới được upload ảnh
router.post(
  '/',
  verifyAdminToken,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Kích thước ảnh vượt quá giới hạn 4MB.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Lỗi tải file: ${err.message}`,
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      return next();
    });
  },
  uploadImage
);

module.exports = router;


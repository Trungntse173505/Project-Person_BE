const cloudinary = require('../config/cloudinary');

/**
 * POST /api/upload
 * Admin: Upload ảnh từ bộ nhớ RAM (buffer) trực tiếp lên Cloudinary
 * Tự động tối ưu định dạng và chất lượng (f_auto, q_auto)
 */
const uploadImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn một file ảnh hợp lệ để tải lên (field name: "image").',
      });
    }

    // Upload trực tiếp từ Buffer trong RAM lên Cloudinary thông qua upload_stream
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'personal_blog',
          resource_type: 'image',
          transformation: [
            { width: 1600, crop: 'limit' }, // Giới hạn chiều rộng tối đa 1600px để tránh ảnh quá khổ
            { quality: 'auto', fetch_format: 'auto' }, // Tự động nén & chuyển WebP/AVIF
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    return res.status(200).json({
      success: true,
      message: 'Tải ảnh lên thành công.',
      data: {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
      },
    });
  } catch (err) {
    console.error('[Upload Image Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải ảnh lên Cloudinary.',
    });
  }
};

module.exports = {
  uploadImage,
};


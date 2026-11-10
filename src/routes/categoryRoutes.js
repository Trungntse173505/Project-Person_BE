const express = require('express');
const router = express.Router();
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { verifyAdminToken } = require('../middlewares/authMiddleware');

// Public: Ai cũng có thể xem danh sách danh mục
router.get('/', getCategories);

// Admin only: Thêm, sửa, xóa danh mục
router.post('/', verifyAdminToken, createCategory);
router.put('/:id', verifyAdminToken, updateCategory);
router.delete('/:id', verifyAdminToken, deleteCategory);

module.exports = router;


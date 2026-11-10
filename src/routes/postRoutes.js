const express = require('express');
const router = express.Router();
const {
  getPublicPosts,
  getPostBySlug,
  getAdminPosts,
  getAdminPostById,
  createPost,
  updatePost,
  deletePost,
} = require('../controllers/postController');
const { verifyAdminToken } = require('../middlewares/authMiddleware');

// 1. Các route dành cho Admin (Đặt trước /:slug để tránh bị nhận nhầm "admin" là một slug)
router.get('/admin/all', verifyAdminToken, getAdminPosts);
router.get('/admin/:id', verifyAdminToken, getAdminPostById);
router.post('/', verifyAdminToken, createPost);
router.put('/:id', verifyAdminToken, updatePost);
router.delete('/:id', verifyAdminToken, deletePost);

// 2. Các route Public cho người đọc
router.get('/', getPublicPosts);
router.get('/:slug', getPostBySlug);

module.exports = router;


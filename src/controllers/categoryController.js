const supabase = require('../config/supabase');
const { createSlug } = require('../utils/slugify');

/**
 * GET /api/categories
 * Public: Lấy danh sách toàn bộ danh mục (kèm số lượng bài viết đã xuất bản)
 */
const getCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, slug, created_at, posts(id, is_published)')
      .order('name', { ascending: true });

    if (error) {
      console.error('[Get Categories DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải danh sách danh mục.',
      });
    }

    // Đếm số bài viết đã xuất bản trong mỗi danh mục và ẩn mảng posts chi tiết đi
    const formatted = (categories || []).map((cat) => {
      const publishedCount = Array.isArray(cat.posts)
        ? cat.posts.filter((p) => p.is_published).length
        : 0;
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        created_at: cat.created_at,
        post_count: publishedCount,
      };
    });

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error('[Get Categories Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * POST /api/categories
 * Admin: Tạo danh mục mới
 */
const createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục không hợp lệ (tối đa 100 ký tự).',
      });
    }

    const cleanName = name.trim();
    const finalSlug = createSlug(slug && typeof slug === 'string' ? slug : cleanName);

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tạo đường dẫn (slug) từ tên danh mục này.',
      });
    }

    // Kiểm tra trùng slug
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Danh mục với đường dẫn (slug) này đã tồn tại.',
      });
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({ name: cleanName, slug: finalSlug })
      .select('id, name, slug, created_at')
      .single();

    if (error) {
      console.error('[Create Category DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo danh mục mới.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo danh mục thành công.',
      data,
    });
  } catch (err) {
    console.error('[Create Category Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * PUT /api/categories/:id
 * Admin: Cập nhật danh mục
 */
const updateCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID danh mục không hợp lệ.',
      });
    }

    const { name, slug } = req.body;
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục không hợp lệ (tối đa 100 ký tự).',
      });
    }

    const cleanName = name.trim();
    const finalSlug = createSlug(slug && typeof slug === 'string' ? slug : cleanName);

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: 'Slug không hợp lệ.',
      });
    }

    // Kiểm tra trùng slug với danh mục khác
    const { data: duplicate } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', finalSlug)
      .neq('id', categoryId)
      .maybeSingle();

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Slug này đã được sử dụng bởi một danh mục khác.',
      });
    }

    const { data, error } = await supabase
      .from('categories')
      .update({ name: cleanName, slug: finalSlug })
      .eq('id', categoryId)
      .select('id, name, slug, created_at')
      .maybeSingle();

    if (error) {
      console.error('[Update Category DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật danh mục.',
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục cần sửa.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật danh mục thành công.',
      data,
    });
  } catch (err) {
    console.error('[Update Category Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * DELETE /api/categories/:id
 * Admin: Xóa danh mục (Các bài viết thuộc danh mục này sẽ tự động chuyển về category_id = NULL)
 */
const deleteCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID danh mục không hợp lệ.',
      });
    }

    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[Delete Category DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể xóa danh mục.',
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Danh mục không tồn tại.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa danh mục thành công.',
    });
  } catch (err) {
    console.error('[Delete Category Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};


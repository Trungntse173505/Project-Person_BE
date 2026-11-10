const supabase = require('../config/supabase');
const { createSlug } = require('../utils/slugify');

/**
 * Tự động trích xuất đoạn tóm tắt ngắn (excerpt) từ nội dung Markdown nếu người dùng để trống
 */
function generateExcerptFromMarkdown(markdown = '', maxLength = 180) {
  if (!markdown || typeof markdown !== 'string') return '';
  const plainText = markdown
    .replace(/!\[.*?\]\(.*?\)/g, '') // Bỏ cú pháp ảnh ![alt](url)
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Giữ lại chữ của link [text](url)
    .replace(/```[\s\S]*?```/g, '') // Bỏ khối code block
    .replace(/`([^`]+)`/g, '$1') // Bỏ inline code
    .replace(/[#>*_~\-]+/g, ' ') // Bỏ ký tự định dạng tiêu đề, in đậm, danh sách
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return plainText.slice(0, maxLength).trim() + '...';
}

/**
 * GET /api/posts
 * Public: Lấy danh sách bài viết đã xuất bản (is_published = true)
 * Hỗ trợ phân trang (page, limit), lọc theo danh mục (category slug hoặc id), và tìm kiếm (search)
 */
const getPublicPosts = async (req, res) => {
  try {
    // Khống chế limit tối đa là 30 bài/lần để chống F12 truyền limit=999999 gây quá tải DB
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const offset = (page - 1) * limit;

    const categoryParam = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const searchParam =
      typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

    let categoryIdFilter = null;

    // Nếu người dùng lọc theo category (có thể truyền ID số hoặc truyền slug danh mục)
    if (categoryParam) {
      if (/^\d+$/.test(categoryParam)) {
        categoryIdFilter = Number(categoryParam);
      } else {
        const { data: cat } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', categoryParam)
          .maybeSingle();

        if (!cat) {
          // Nếu truyền slug danh mục không tồn tại -> trả về mảng rỗng ngay
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          });
        }
        categoryIdFilter = cat.id;
      }
    }

    // Không select trường `content` ở danh sách trang chủ để tối ưu băng thông và tốc độ
    let query = supabase
      .from('posts')
      .select(
        'id, title, slug, excerpt, cover_image, category_id, is_published, created_at, updated_at, categories(id, name, slug)',
        { count: 'exact' }
      )
      .eq('is_published', true);

    if (categoryIdFilter !== null) {
      query = query.eq('category_id', categoryIdFilter);
    }

    if (searchParam) {
      // Làm sạch ký tự đặc biệt của PostgREST filter trước khi tìm kiếm
      const safeSearch = searchParam.replace(/[%_(),.]/g, '');
      if (safeSearch) {
        query = query.or(`title.ilike.%${safeSearch}%,excerpt.ilike.%${safeSearch}%`);
      }
    }

    const { data: posts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Get Public Posts DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải danh sách bài viết.',
      });
    }

    const total = count || 0;
    return res.status(200).json({
      success: true,
      data: posts || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Get Public Posts Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * GET /api/posts/:slug
 * Public: Xem chi tiết 1 bài viết đã xuất bản theo slug (Bao gồm toàn bộ nội dung Markdown)
 */
const getPostBySlug = async (req, res) => {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';

    if (!slug || slug.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Đường dẫn bài viết không hợp lệ.',
      });
    }

    const { data: post, error } = await supabase
      .from('posts')
      .select(
        'id, title, slug, content, excerpt, cover_image, category_id, is_published, created_at, updated_at, categories(id, name, slug)'
      )
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) {
      console.error('[Get Post By Slug DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi tải nội dung bài viết.',
      });
    }

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết hoặc bài viết đang ở chế độ nháp.',
      });
    }

    // Lấy tối đa 3 bài viết liên quan (ưu tiên cùng danh mục, trừ bài hiện tại)
    let relatedPosts = [];
    if (post.category_id) {
      const { data: related } = await supabase
        .from('posts')
        .select(
          'id, title, slug, excerpt, cover_image, category_id, is_published, created_at, updated_at, categories(id, name, slug)'
        )
        .eq('is_published', true)
        .eq('category_id', post.category_id)
        .neq('id', post.id)
        .order('created_at', { ascending: false })
        .limit(3);

      relatedPosts = related || [];
    }

    // Nếu trong cùng danh mục chưa đủ 3 bài, lấy thêm các bài viết mới nhất khác để bổ sung (tối đa 3 bài)
    if (relatedPosts.length < 3) {
      const excludeIds = [post.id, ...relatedPosts.map((p) => p.id)];
      const needed = 3 - relatedPosts.length;

      let fallbackQuery = supabase
        .from('posts')
        .select(
          'id, title, slug, excerpt, cover_image, category_id, is_published, created_at, updated_at, categories(id, name, slug)'
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(needed);

      if (excludeIds.length === 1) {
        fallbackQuery = fallbackQuery.neq('id', excludeIds[0]);
      } else if (excludeIds.length > 1) {
        fallbackQuery = fallbackQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: latestOther } = await fallbackQuery;

      if (latestOther && latestOther.length > 0) {
        relatedPosts = [...relatedPosts, ...latestOther];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...post,
        related_posts: relatedPosts,
      },
    });
  } catch (err) {
    console.error('[Get Post By Slug Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * GET /api/posts/admin/all
 * Admin: Lấy toàn bộ bài viết (bao gồm cả bài đã đăng và bản nháp) để quản lý
 */
const getAdminPosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const status = req.query.status; // 'published' | 'draft' | undefined
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const searchParam =
      typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

    let query = supabase
      .from('posts')
      .select(
        'id, title, slug, excerpt, cover_image, category_id, is_published, created_at, updated_at, categories(id, name, slug)',
        { count: 'exact' }
      );

    if (status === 'published') {
      query = query.eq('is_published', true);
    } else if (status === 'draft') {
      query = query.eq('is_published', false);
    }

    if (categoryId && Number.isInteger(categoryId)) {
      query = query.eq('category_id', categoryId);
    }

    if (searchParam) {
      const safeSearch = searchParam.replace(/[%_(),.]/g, '');
      if (safeSearch) {
        query = query.or(`title.ilike.%${safeSearch}%,excerpt.ilike.%${safeSearch}%`);
      }
    }

    const { data: posts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Get Admin Posts DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải danh sách bài viết cho Admin.',
      });
    }

    const total = count || 0;
    return res.status(200).json({
      success: true,
      data: posts || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Get Admin Posts Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * GET /api/posts/admin/:id
 * Admin: Lấy chi tiết bài viết theo ID (kể cả bản nháp) để đưa vào form chỉnh sửa
 */
const getAdminPostById = async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ.',
      });
    }

    const { data: post, error } = await supabase
      .from('posts')
      .select(
        'id, title, slug, content, excerpt, cover_image, category_id, is_published, created_at, updated_at, categories(id, name, slug)'
      )
      .eq('id', postId)
      .maybeSingle();

    if (error) {
      console.error('[Get Admin Post By ID DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi tải bài viết.',
      });
    }

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết.',
      });
    }

    return res.status(200).json({
      success: true,
      data: post,
    });
  } catch (err) {
    console.error('[Get Admin Post By ID Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * POST /api/posts
 * Admin: Tạo bài viết mới
 */
const createPost = async (req, res) => {
  try {
    const { title, slug, content, excerpt, cover_image, category_id, is_published } = req.body;

    if (!title || typeof title !== 'string' || !title.trim() || title.trim().length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề bài viết là bắt buộc và tối đa 255 ký tự.',
      });
    }

    const cleanTitle = title.trim();
    let finalSlug = createSlug(slug && typeof slug === 'string' ? slug : cleanTitle);

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: 'Không thể khởi tạo đường dẫn (slug) hợp lệ từ tiêu đề này.',
      });
    }

    // Kiểm tra xem slug đã tồn tại chưa, nếu trùng thì tự động nối thêm hậu tố thời gian ngắn
    const { data: existingSlug } = await supabase
      .from('posts')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle();

    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
    }

    const cleanContent = typeof content === 'string' ? content : '';
    const cleanExcerpt =
      typeof excerpt === 'string' && excerpt.trim()
        ? excerpt.trim()
        : generateExcerptFromMarkdown(cleanContent);

    const cleanCoverImage =
      typeof cover_image === 'string' && cover_image.trim() ? cover_image.trim().slice(0, 500) : null;

    const parsedCategoryId =
      category_id !== undefined && category_id !== null && category_id !== ''
        ? Number(category_id)
        : null;

    if (parsedCategoryId !== null && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Danh mục được chọn không hợp lệ.',
      });
    }

    const publishedState = typeof is_published === 'boolean' ? is_published : true;

    const { data, error } = await supabase
      .from('posts')
      .insert({
        title: cleanTitle,
        slug: finalSlug,
        content: cleanContent,
        excerpt: cleanExcerpt,
        cover_image: cleanCoverImage,
        category_id: parsedCategoryId,
        is_published: publishedState,
      })
      .select(
        'id, title, slug, content, excerpt, cover_image, category_id, is_published, created_at, updated_at'
      )
      .single();

    if (error) {
      console.error('[Create Post DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể lưu bài viết mới.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo bài viết thành công.',
      data,
    });
  } catch (err) {
    console.error('[Create Post Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * PUT /api/posts/:id
 * Admin: Cập nhật bài viết
 */
const updatePost = async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ.',
      });
    }

    const { title, slug, content, excerpt, cover_image, category_id, is_published } = req.body;

    if (!title || typeof title !== 'string' || !title.trim() || title.trim().length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề bài viết là bắt buộc và tối đa 255 ký tự.',
      });
    }

    const cleanTitle = title.trim();
    const finalSlug = createSlug(slug && typeof slug === 'string' ? slug : cleanTitle);

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: 'Đường dẫn (slug) không hợp lệ.',
      });
    }

    // Kiểm tra trùng slug với bài viết khác
    const { data: duplicate } = await supabase
      .from('posts')
      .select('id')
      .eq('slug', finalSlug)
      .neq('id', postId)
      .maybeSingle();

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Đường dẫn (slug) này đã thuộc về một bài viết khác.',
      });
    }

    const cleanContent = typeof content === 'string' ? content : '';
    const cleanExcerpt =
      typeof excerpt === 'string' && excerpt.trim()
        ? excerpt.trim()
        : generateExcerptFromMarkdown(cleanContent);

    const cleanCoverImage =
      typeof cover_image === 'string' && cover_image.trim() ? cover_image.trim().slice(0, 500) : null;

    const parsedCategoryId =
      category_id !== undefined && category_id !== null && category_id !== ''
        ? Number(category_id)
        : null;

    if (parsedCategoryId !== null && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Danh mục được chọn không hợp lệ.',
      });
    }

    const updatePayload = {
      title: cleanTitle,
      slug: finalSlug,
      content: cleanContent,
      excerpt: cleanExcerpt,
      cover_image: cleanCoverImage,
      category_id: parsedCategoryId,
      updated_at: new Date().toISOString(),
    };

    if (typeof is_published === 'boolean') {
      updatePayload.is_published = is_published;
    }

    const { data, error } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', postId)
      .select(
        'id, title, slug, content, excerpt, cover_image, category_id, is_published, created_at, updated_at'
      )
      .maybeSingle();

    if (error) {
      console.error('[Update Post DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật bài viết.',
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết cần cập nhật.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật bài viết thành công.',
      data,
    });
  } catch (err) {
    console.error('[Update Post Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

/**
 * DELETE /api/posts/:id
 * Admin: Xóa bài viết
 */
const deletePost = async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ.',
      });
    }

    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[Delete Post DB Error]:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể xóa bài viết.',
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa bài viết thành công.',
    });
  } catch (err) {
    console.error('[Delete Post Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ.',
    });
  }
};

module.exports = {
  getPublicPosts,
  getPostBySlug,
  getAdminPosts,
  getAdminPostById,
  createPost,
  updatePost,
  deletePost,
};


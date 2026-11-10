/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành slug chuẩn SEO
 * Ví dụ: "Học Lập Trình Next.js & Node.js!" -> "hoc-lap-trinh-nextjs-nodejs"
 */
function createSlug(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Tách dấu ra khỏi chữ cái gốc
    .replace(/[\u0300-\u036f]/g, '') // Xóa các dấu thanh, dấu mũ
    .replace(/[đĐ]/g, 'd') // Chuyển đ/Đ thành d
    .replace(/[^a-z0-9\s-]/g, '') // Xóa ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '-') // Thay khoảng trắng bằng dấu gạch ngang
    .replace(/-+/g, '-') // Gộp nhiều dấu gạch ngang liên tiếp
    .replace(/^-+|-+$/g, ''); // Xóa gạch ngang ở đầu và cuối
}

module.exports = {
  createSlug,
};


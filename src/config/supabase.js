const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isConfigured =
  supabaseUrl &&
  /^https?:\/\//i.test(supabaseUrl) &&
  supabaseKey
if (!isConfigured) {
  console.warn(
    '⚠️ [CẢNH BÁO]: SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình hợp lệ trong file .env!'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;

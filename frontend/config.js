// 只允許 Supabase 可公開的 publishable key。不得填入 secret/service_role。
export const SUPABASE_URL = "";
export const SUPABASE_PUBLISHABLE_KEY = "";
export const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

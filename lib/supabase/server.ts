import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server credentials are missing. Add SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  return createClient(url, serviceKey);
}

let _admin: ReturnType<typeof getSupabaseAdmin> | null = null;

export function supabaseAdmin() {
  if (!_admin) {
    _admin = getSupabaseAdmin();
  }
  return _admin;
}

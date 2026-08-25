import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cookie-based client for reading user sessions (uses anon key)
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://omhnymwavnfdwhoutueo.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_chywf4oJZ7ET3HQSxHvKxw_hdrew83k",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

// Admin client for server-side database writes (MUST use service role key)
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://omhnymwavnfdwhoutueo.supabase.co";
  const serviceKey = process.env.SUPABASE_SECRET_KEY || "sb_secret__Bk_Uwp8f8X6I3HkBHoXCw_vysnSH7J";

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin credentials missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel environment variables (Standard type, not Sensitive)."
    );
  }

  return createSupabaseClient(url, serviceKey);
}

let _admin: ReturnType<typeof getSupabaseAdmin> | null = null;

export function supabaseAdmin() {
  if (!_admin) {
    _admin = getSupabaseAdmin();
  }
  return _admin;
}

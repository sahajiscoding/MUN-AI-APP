import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cookie-based client for reading user sessions (uses anon key)
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

// Admin client for server-side database writes (uses service role key)
function getSupabaseAdmin() {
  // Try private vars first, fall back to NEXT_PUBLIC vars
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server credentials are missing.");
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

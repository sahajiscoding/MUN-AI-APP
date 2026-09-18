import { createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabasePublishableKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              secure: true,
              sameSite: "lax",
            });
          });
        } catch {
          // Server Components cannot always modify cookies.
        }
      },
    },
  });
}

// Backend-only Supabase secret key. This is intentionally never imported by
// client components. Use separate Supabase secret keys per backend component
// where the project supports them, rather than sharing one credential across
// unrelated services.
function getSupabaseAdmin() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = getRequiredEnv("SUPABASE_SECRET_KEY");

  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

let adminClient: ReturnType<typeof getSupabaseAdmin> | null = null;

export function supabaseAdmin() {
  if (!adminClient) adminClient = getSupabaseAdmin();
  return adminClient;
}

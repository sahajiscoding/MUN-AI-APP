"use client";

import { User as SupaUser } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "@/lib/supabase/client";

type AuthContextValue = {
  user: SupaUser | null;
  loading: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<{ sessionCreated: boolean }>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const noopAsync = () => Promise.resolve();

const stubValue: AuthContextValue = {
  user: null,
  loading: true,
  signInWithGoogle: noopAsync,
  signInWithEmail: noopAsync,
  signUpWithEmail: async () => ({ sessionCreated: false }),
  logout: noopAsync,
  getIdToken: () => Promise.reject(new Error("Not hydrated yet")),
};

/** Provides Supabase authentication state to the app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<SupaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<ReturnType<typeof getSupabase> | null>(null);

  /** Syncs the Supabase user profile to the server user record. */
  const syncUserRecord = useCallback(async (supaUser: SupaUser) => {
    try {
      const client = clientRef.current;
      if (!client) return;
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/me", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: supaUser.user_metadata?.full_name ?? supaUser.user_metadata?.name ?? "",
        }),
      });
      if (!response.ok) console.warn("Could not sync Supabase user profile yet.");
    } catch (err) {
      console.warn("Could not sync Supabase user profile yet.", err);
    }
  }, []);

  useEffect(() => {
    clientRef.current = getSupabase();
    setHydrated(true);
    const client = clientRef.current;

    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) void syncUserRecord(session.user);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) void syncUserRecord(session.user);
    });

    return () => subscription.unsubscribe();
  }, [syncUserRecord]);

  const value = useMemo<AuthContextValue>(() => {
    if (!hydrated) return stubValue;
    const client = clientRef.current!;

    return {
      user,
      loading,
      /** Starts Google OAuth sign-in with the given post-login path. */
      async signInWithGoogle(next = "/dashboard") {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            skipBrowserRedirect: false,
          },
        });
        if (error) throw error;
      },
      /** Signs in with email and password via the auth API. */
      async signInWithEmail(email, password) {
        const response = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email, password }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.session) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Authentication failed.");
        }
        const { error } = await client.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
        if (error) throw error;
      },
      /** Registers a new account with name, email, and password. */
      async signUpWithEmail(name, email, password) {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ name, email, password, website: "" }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Sign up failed.");
        }
        return { sessionCreated: Boolean(payload.sessionCreated) };
      },
      /** Signs out of the current Supabase session. */
      async logout() {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
      /** Returns the current Supabase access token. */
      async getIdToken() {
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("You need to sign in again.");
        return token;
      },
    };
  }, [hydrated, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Returns the current authentication context value. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

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
  signInWithGoogle: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<SupaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<ReturnType<typeof getSupabase> | null>(null);

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
      if (!response.ok) {
        console.warn("Could not sync Supabase user profile yet.");
      }
    } catch (err) {
      console.warn("Could not sync Supabase user profile yet.", err);
    }
  }, []);

  // Only initialize Supabase client after hydration (client-side only)
  useEffect(() => {
    clientRef.current = getSupabase();
    setHydrated(true);

    const client = clientRef.current;

    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        syncUserRecord(session.user);
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        syncUserRecord(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncUserRecord]);

  const value = useMemo<AuthContextValue>(() => {
    if (!hydrated) return stubValue;

    const client = clientRef.current!;

    return {
      user,
      loading,
      async signInWithGoogle() {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            skipBrowserRedirect: false,
          },
        });
        if (error) throw error;
      },
      async signInWithEmail(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUpWithEmail(name, email, password) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });
        if (error) throw error;
        return { sessionCreated: Boolean(data.session) };
      },
      async logout() {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
      async getIdToken() {
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          throw new Error("You need to sign in again.");
        }
        return token;
      },
    };
  }, [hydrated, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

"use client";

import {
  Bot,
  CheckCircle2,
  Crown,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  uid: string;
  display_name: string;
  email: string;
  last_seen_at: string;
  isAdmin: boolean;
  entitlement: {
    status: string;
    plan_id?: string;
    expires_at?: string;
  };
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiMode, setAiMode] = useState<"quick" | "thorough" | "max">("thorough");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/c8f2x9/users");
      if (res.status === 401) {
        router.push("/c8f2x9");
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function approveUser(uid: string) {
    await fetch("/api/c8f2x9/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    fetchUsers();
  }

  async function revokeUser(uid: string) {
    await fetch("/api/c8f2x9/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    fetchUsers();
  }

  async function handleLogout() {
    await fetch("/api/c8f2x9/login", { method: "DELETE" });
    router.push("/c8f2x9");
  }

  async function handleAiTest(e: FormEvent) {
    e.preventDefault();
    if (!aiPrompt.trim() || aiStreaming) return;

    setAiStreaming(true);
    setAiOutput("");

    const maxTokens = aiMode === "max" ? 8000 : aiMode === "thorough" ? 4000 : 1000;
    const temperature = aiMode === "max" ? 1.0 : aiMode === "thorough" ? 0.85 : 0.7;

    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          committee: "General",
          agenda: aiPrompt.length < 5 ? `${aiPrompt} — respond naturally` : aiPrompt,
          country: "Any",
          experienceLevel: "intermediate",
          provider: "nvidia",
          maxTokens,
          temperature
        }),
      });

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setAiOutput(fullContent);
                }
              } catch {
                // skip
              }
            }
          }
        }
      } else {
        const data = await res.json();
        setAiOutput(data.content || data.error?.message || "No response");
      }
    } catch {
      setAiOutput("Request failed.");
    } finally {
      setAiStreaming(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.uid?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--ink)]">
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--patina)] text-white">
            <Crown className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-bold text-[var(--paper)]">Dashboard</h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:bg-white/10 transition"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        {/* AI Testing */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-[var(--brass)]" />
            <h2 className="text-lg font-bold text-[var(--paper)]">Free AI Testing</h2>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--patina)]/20 text-[var(--patina)] text-xs font-semibold">
              Internal
            </span>
          </div>

          <form onSubmit={handleAiTest} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                {(["quick", "thorough", "max"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAiMode(m)}
                    className={
                      aiMode === m
                        ? "bg-[var(--paper)] text-[var(--ink)] px-3 py-1.5 text-xs font-semibold"
                        : "px-3 py-1.5 text-xs font-semibold text-white/50 hover:bg-white/10"
                    }
                  >
                    {m === "quick" ? "Quick" : m === "thorough" ? "Thorough" : "Max"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Type anything to test..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm text-[var(--paper)] placeholder:text-white/40 focus:outline-none focus:border-[var(--brass)]/50"
              />
              <button
                type="submit"
                disabled={aiStreaming || !aiPrompt.trim()}
                className="px-4 py-2.5 rounded-xl bg-[var(--brass)] text-[var(--ink)] font-semibold text-sm hover:brightness-110 transition disabled:opacity-40"
              >
                {aiStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </form>

          {aiOutput && (
            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4">
              <article className="text-sm text-[var(--paper)]/80 whitespace-pre-wrap leading-6 max-h-96 overflow-y-auto">
                {aiOutput}
                {aiStreaming && (
                  <span className="inline-block w-2 h-4 bg-[var(--brass)] animate-pulse ml-0.5 align-middle" />
                )}
              </article>
            </div>
          )}
        </section>

        {/* User Management */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--patina)]" />
              <h2 className="text-lg font-bold text-[var(--paper)]">Users</h2>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">
                {users.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-4 py-1.5 w-52 rounded-lg bg-white/10 border border-white/10 text-sm text-[var(--paper)] placeholder:text-white/40 focus:outline-none focus:border-[var(--brass)]/50"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-white/40 text-sm">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-white/50 font-semibold">User</th>
                    <th className="text-left py-3 px-3 text-white/50 font-semibold">UID</th>
                    <th className="text-left py-3 px-3 text-white/50 font-semibold">Status</th>
                    <th className="text-left py-3 px-3 text-white/50 font-semibold">Last Seen</th>
                    <th className="text-right py-3 px-3 text-white/50 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr
                      key={user.uid}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="py-3 px-3">
                        <div>
                          <p className="text-[var(--paper)] font-semibold">
                            {user.display_name || "Unnamed"}
                          </p>
                          <p className="text-white/40 text-xs">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <code className="text-xs text-white/40 font-mono">
                          {user.uid.slice(0, 12)}...
                        </code>
                      </td>
                      <td className="py-3 px-3">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--brass)]/20 text-[var(--brass)] text-xs font-semibold">
                            <Crown className="h-3 w-3" />
                            Admin
                          </span>
                        ) : user.entitlement.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--patina)]/20 text-[var(--patina)] text-xs font-semibold">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/40 text-xs">
                            <XCircle className="h-3 w-3" />
                            Free
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-white/40 text-xs">
                        {user.last_seen_at
                          ? new Date(user.last_seen_at).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1">
                          {!user.isAdmin ? (
                            <button
                              onClick={() => approveUser(user.uid)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-[var(--patina)] hover:bg-[var(--patina)]/10 transition"
                              title="Approve"
                            >
                              <UserPlus className="h-3 w-3" />
                              Approve
                            </button>
                          ) : (
                            <button
                              onClick={() => revokeUser(user.uid)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-400/10 transition"
                              title="Revoke"
                            >
                              <Trash2 className="h-3 w-3" />
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

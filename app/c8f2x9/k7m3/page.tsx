"use client";

import {
  Ban,
  Bot,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

type AdminUser = {    uid: string;
    display_name: string;
    email: string;
    last_seen_at: string;
    isAdmin: boolean;
    entitlement: {
      status: string;
      plan_id?: string;
      source?: string;
      expires_at?: string | null;
    };
  referral: {
    code: string;
    status: string;
    link: string | null;
  } | null;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getExpiry(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const target = new Date(expiresAt);
  if (Number.isNaN(target.getTime())) return null;
  const diffDays = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return { target, diffDays, lapsed: diffDays <= 0 };
}

function formatExpiryDate(target: Date) {
  return target.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ExpiryNote({ expiresAt }: { expiresAt?: string | null }) {
  const expiry = getExpiry(expiresAt);
  if (!expiry) return null;

  const dateLabel = formatExpiryDate(expiry.target);

  if (expiry.lapsed) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-[var(--oxblood)]/25 bg-[var(--oxblood)]/8 px-2 py-1 text-xs font-semibold text-[var(--oxblood)]"
        title={`Pass lapsed on ${dateLabel}`}
      >
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Lapsed {dateLabel}
      </span>
    );
  }

  const expiresSoon = expiry.diffDays <= 7;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        expiresSoon
          ? "border border-[var(--brass)]/25 bg-[var(--brass)]/8 text-[var(--brass)]"
          : "border border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]"
      }`}
      title={`Pass expires on ${dateLabel}`}
    >
      <CalendarPlus className="h-3 w-3" aria-hidden="true" />
      {expiry.diffDays === 1 ? "Expires in 1 day" : `Expires in ${expiry.diffDays} days`}
      <span className="opacity-70">· {dateLabel}</span>
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiMode, setAiMode] = useState<"quick" | "thorough" | "max">("thorough");
  const [copiedReferralUid, setCopiedReferralUid] = useState<string | null>(null);
  const [customGrant, setCustomGrant] = useState<{
    uid: string;
    label: string;
    date: string;
    min: string;
    currentExpiry: string | null;
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/c8f2x9/users");
      if (res.status === 401) {
        router.push("/c8f2x9");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load users.");
      setUsers(data.users || []);
    } catch (error) {
      setUsers([]);
      setStatusMessage(error instanceof Error ? error.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Re-render the expiry notes on a slow tick so a pass that lapses while this
  // tab is open flips to "Expired" without needing a manual refresh.
  const [, setExpiryTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => { setExpiryTick((value) => value + 1); }, 60_000);
    return () => { window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!customGrant) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCustomGrant(null);
    };

    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("keydown", handleKey); };
  }, [customGrant]);

  async function mutateAdmin(uid: string, action: "approve" | "revoke") {
    if (actionBusy) return;
    setActionBusy(`${action}:${uid}`);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/c8f2x9/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Could not ${action} user.`);
      setStatusMessage(data.message || `User ${action}d.`);
      await fetchUsers();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : `Could not ${action} user.`);
    } finally {
      setActionBusy("");
    }
  }

  async function handleLogout() {
    await fetch("/api/c8f2x9/login", { method: "DELETE" });
    router.push("/c8f2x9");
  }

  async function grantSubscription(uid: string, planId: "weekly-pass" | "monthly-pass") {
    if (actionBusy) return;
    setActionBusy(`grant:${planId}:${uid}`);
    setStatusMessage("");
    try {
      const response = await fetch("/api/c8f2x9/grant-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, planId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not grant the subscription.");
      setStatusMessage(data.message || "Subscription granted.");
      await fetchUsers();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not grant the subscription.");
    } finally {
      setActionBusy("");
    }
  }

  async function grantCustomExpiry() {
    if (!customGrant || actionBusy) return;
    if (!customGrant.date) {
      setStatusMessage("Pick an expiry date for the custom pass.");
      return;
    }

    const uid = customGrant.uid;
    setActionBusy(`grant-custom:${uid}`);
    setStatusMessage("");
    try {
      const response = await fetch("/api/c8f2x9/grant-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, expiresAt: customGrant.date }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not grant the custom pass.");
      setStatusMessage(data.message || "Custom pass granted.");
      setCustomGrant(null);
      await fetchUsers();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not grant the custom pass.");
    } finally {
      setActionBusy("");
    }
  }

  async function revokeSubscription(uid: string) {
    if (actionBusy) return;
    if (!window.confirm("Revoke the manually granted subscription for this user? Paid subscriptions are never affected.")) return;
    setActionBusy(`revoke-pass:${uid}`);
    setStatusMessage("");
    try {
      const response = await fetch("/api/c8f2x9/revoke-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not revoke the subscription.");
      setStatusMessage(data.message || "Subscription revoked.");
      await fetchUsers();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not revoke the subscription.");
    } finally {
      setActionBusy("");
    }
  }

  async function copyReferralLink(user: AdminUser) {
    const link = user.referral?.link;
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedReferralUid(user.uid);
      window.setTimeout(() => { setCopiedReferralUid((current) => current === user.uid ? null : current); }, 1800);
    } catch {
      setStatusMessage("Could not copy the referral link. Please open it and copy the URL manually.");
    }
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
          temperature,
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
                // Ignore malformed provider chunks.
              }
            }
          }
        }
      } else {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "The AI request failed.");
        setAiOutput(data.content || "No response");
      }
    } catch (error) {
      setAiOutput(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setAiStreaming(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--paper-strong)] shadow-sm">
              <Crown className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="label-text">MUN Prep · private control room</p>
              <h1 className="display-type truncate text-xl sm:text-2xl">Administrator dashboard</h1>
            </div>
          </div>
          <nav className="flex shrink-0 items-center gap-2" aria-label="Administrator navigation">
            <ThemeToggle />
            <Link href="/admin/analytics" className="button-secondary inline-flex items-center px-3 py-2 text-sm font-semibold sm:px-4">
              Analytics
            </Link>
            <Link href="/admin/referrals" className="button-secondary inline-flex items-center px-3 py-2 text-sm font-semibold sm:px-4">
              Referrals
            </Link>
            <button
              onClick={handleLogout}
              className="button-primary inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold sm:px-4"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="diplomatic-grid min-h-[calc(100vh-65px)]">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <section className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] px-5 py-5 shadow-[0_20px_70px_rgba(23,20,18,0.08)] sm:px-7 sm:py-7">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-[var(--brass)]/25" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-4 -top-12 h-44 w-44 rounded-full border border-[var(--patina)]/20" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <p className="label-text">Operations brief</p>
              <h2 className="display-type mt-2 text-3xl leading-tight sm:text-4xl">Keep the room ready.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                Manage delegate access and test the debate assistant from one secure, server-backed workspace.
              </p>
            </div>
          </section>

          {statusMessage ? (
            <p className="rounded-xl border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-4 py-3 text-sm font-medium text-[var(--ink)]" role="status">
              {statusMessage}
            </p>
          ) : null}

          <section className="surface rounded-xl p-5 sm:p-7" aria-labelledby="ai-testing-heading">
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--patina)]/12 text-[var(--patina)]">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="label-text">Provider check</p>
                  <h2 id="ai-testing-heading" className="display-type mt-1 text-2xl">Test the debate assistant</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Internal testing uses the protected MiniMax M3 route.</p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-[var(--patina)]/25 bg-[var(--patina)]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--patina)]">
                Internal only
              </span>
            </div>

            <form onSubmit={handleAiTest} className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2" aria-label="Response mode">
                {(["quick", "thorough", "max"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setAiMode(m); }}
                    className={
                      aiMode === m
                        ? "rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--paper-strong)] shadow-sm"
                        : "rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--ink)]/30 hover:text-[var(--ink)]"
                    }
                  >
                    {m === "quick" ? "Quick" : m === "thorough" ? "Thorough" : "Max"}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="admin-ai-prompt" className="sr-only">AI test prompt</label>
                <input
                  id="admin-ai-prompt"
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => { setAiPrompt(e.target.value); }}
                  placeholder="Ask a concise MUN research question..."
                  className="input-field flex-1"
                />
                <button
                  type="submit"
                  disabled={aiStreaming || !aiPrompt.trim()}
                  className="button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {aiStreaming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {aiStreaming ? "Testing" : "Run test"}
                </button>
              </div>
            </form>

            {aiOutput ? (
              <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="label-text">Assistant response</p>
                  {aiStreaming ? <span className="text-xs font-semibold text-[var(--patina)]">Streaming</span> : null}
                </div>
                <article className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                  {aiOutput}
                  {aiStreaming ? <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-[var(--brass)] align-middle" aria-label="Response is still being generated" /> : null}
                </article>
              </div>
            ) : null}
          </section>

          <section className="surface rounded-xl p-5 sm:p-7" aria-labelledby="users-heading">
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label-text">Access registry</p>
                <div className="mt-1 flex items-center gap-3">
                  <h2 id="users-heading" className="display-type text-2xl">Users</h2>
                  <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs font-bold text-[var(--paper-strong)]">{users.length}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">Approve or revoke administrator access deliberately.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
                <label htmlFor="user-search" className="sr-only">Search users</label>
                <input
                  id="user-search"
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); }}
                  placeholder="Search users..."
                  className="input-field pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16" aria-live="polite">
                <Loader2 className="h-7 w-7 animate-spin text-[var(--patina)]" aria-label="Loading users" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-16 text-center text-sm text-[var(--muted)]">No users found.</p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="w-full min-w-[940px] border-collapse text-sm">
                  <caption className="sr-only">MUN Prep user access registry</caption>
                  <thead className="bg-[var(--brass)]/10">
                    <tr className="border-b border-[var(--line)]">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">User</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">UID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Referral link</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Last seen</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user) => (
                      <tr key={user.uid} className="border-b border-[var(--line)] last:border-b-0 transition hover:bg-[var(--patina)]/5">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[var(--ink)]">{user.display_name || "Unnamed"}</p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <code className="mono-type rounded bg-[var(--ink)]/5 px-2 py-1 text-xs text-[var(--muted)]">{user.uid.slice(0, 12)}...</code>
                        </td>
                        <td className="px-4 py-3">
                          {user.isAdmin ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)]/15 px-2.5 py-1 text-xs font-bold text-[var(--oxblood)]">
                              <Crown className="h-3 w-3" aria-hidden="true" />
                              Admin
                            </span>
                          ) : getExpiry(user.entitlement.expires_at)?.lapsed ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--oxblood)]/8 px-2.5 py-1 text-xs font-bold text-[var(--oxblood)]">
                              <XCircle className="h-3 w-3" aria-hidden="true" />
                              Expired
                            </span>
                          ) : user.entitlement.status === "active" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--patina)]/12 px-2.5 py-1 text-xs font-bold text-[var(--patina)]">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)]/6 px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                              <XCircle className="h-3 w-3" aria-hidden="true" />
                              Free
                            </span>
                          )}
                          {user.entitlement.expires_at && (user.entitlement.status === "active" || getExpiry(user.entitlement.expires_at)?.lapsed) ? (
                            <div className="mt-1.5">
                              <ExpiryNote expiresAt={user.entitlement.expires_at} />
                            </div>
                          ) : null}
                        </td>
                        <td className="max-w-[280px] px-4 py-3">
                          {user.referral?.link ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={user.referral.link}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 truncate text-xs font-semibold text-[var(--patina)] underline decoration-[var(--patina)]/30 underline-offset-2 hover:text-[var(--oxblood)]"
                                title={user.referral.link}
                              >
                                /login/referral-{user.referral.code}
                              </a>
                              <button
                                type="button"
                                onClick={() => void copyReferralLink(user)}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs font-bold text-[var(--muted)] transition hover:border-[var(--patina)]/40 hover:text-[var(--patina)]"
                                aria-label={`Copy referral link for ${user.display_name || user.email}`}
                                title="Copy referral link"
                              >
                                {copiedReferralUid === user.uid ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                                <span className="sr-only">{copiedReferralUid === user.uid ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">
                              {user.referral?.status ? `Partner ${user.referral.status}` : "Not a partner"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--muted)]">
                          {user.last_seen_at ? new Date(user.last_seen_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {!user.isAdmin ? (
                              <button
                                onClick={() => grantSubscription(user.uid, "weekly-pass")}
                                disabled={Boolean(actionBusy)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--brass)] transition hover:bg-[var(--brass)]/10 disabled:opacity-40"
                                title="Manually grant one week of Premium access"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                                Weekly
                              </button>
                            ) : null}
                            {!user.isAdmin ? (
                              <button
                                onClick={() => grantSubscription(user.uid, "monthly-pass")}
                                disabled={Boolean(actionBusy)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--brass)] transition hover:bg-[var(--brass)]/10 disabled:opacity-40"
                                title="Manually grant one month of Premium access"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                                Monthly
                              </button>
                            ) : null}
                            {!user.isAdmin ? (
                              <button
                                type="button"
                                onClick={() => {
                                  // A live pass is extended rather than replaced, so
                                  // the earliest grantable date is the day after it.
                                  const live = user.entitlement.status === "active" ? getExpiry(user.entitlement.expires_at) : null;
                                  const inForce = live && !live.lapsed ? live : null;
                                  const earliest = inForce ? inForce.target.getTime() + ONE_DAY_MS : Date.now() + ONE_DAY_MS;

                                  setCustomGrant({
                                    uid: user.uid,
                                    label: user.display_name || user.email || user.uid,
                                    date: "",
                                    min: new Date(earliest).toISOString().slice(0, 10),
                                    currentExpiry: inForce ? formatExpiryDate(inForce.target) : null,
                                  });
                                }}
                                disabled={Boolean(actionBusy)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--brass)] transition hover:bg-[var(--brass)]/10 disabled:opacity-40"
                                title="Grant access that ends on a date you choose"
                              >
                                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                Until date…
                              </button>
                            ) : null}
                            {user.entitlement.status === "active" && user.entitlement.source === "admin_manual" ? (
                              <button
                                onClick={() => revokeSubscription(user.uid)}
                                disabled={Boolean(actionBusy)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--oxblood)] transition hover:bg-[var(--oxblood)]/10 disabled:opacity-40"
                                title="Revoke the manually granted subscription"
                              >
                                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                                Revoke pass
                              </button>
                            ) : null}
                            {!user.isAdmin ? (
                              <button
                                onClick={() => mutateAdmin(user.uid, "approve")}
                                disabled={Boolean(actionBusy)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--patina)] transition hover:bg-[var(--patina)]/10 disabled:opacity-40"
                                title="Approve administrator access"
                              >
                                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                                Approve
                              </button>
                            ) : (
                              <button
                                onClick={() => mutateAdmin(user.uid, "revoke")}
                                disabled={Boolean(actionBusy)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--oxblood)] transition hover:bg-[var(--oxblood)]/10 disabled:opacity-40"
                                title="Revoke administrator access"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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

        {customGrant ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="custom-grant-heading">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={() => { setCustomGrant(null); }}
              aria-label="Close the custom pass dialog"
            />
            <div className="surface relative w-full max-w-sm rounded-xl border border-[var(--line)] p-5 shadow-2xl">
              <h2 id="custom-grant-heading" className="display-type text-xl">Grant a pass until a date</h2>
              <p className="mt-1 truncate text-sm text-[var(--muted)]">{customGrant.label}</p>

              {customGrant.currentExpiry ? (
                <p className="mt-3 rounded-panel border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
                  This pass currently runs to <strong className="text-[var(--ink)]">{customGrant.currentExpiry}</strong>. A new grant extends it from
                  there, so the earliest date you can pick is the day after.
                </p>
              ) : null}

              <label className="mt-4 block">
                <span className="label-text">Access ends on</span>
                <input
                  type="date"
                  className="input-field mt-2"
                  value={customGrant.date}
                  min={customGrant.min}
                  autoFocus
                  onChange={(event) => { setCustomGrant({ ...customGrant, date: event.target.value }); }}
                />
              </label>

              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Access runs to the end of that day.
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button type="button" onClick={() => { setCustomGrant(null); }} className="button-secondary px-4 py-2 text-sm font-semibold">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void grantCustomExpiry()}
                  disabled={!customGrant.date || Boolean(actionBusy)}
                  className="button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {actionBusy.startsWith("grant-custom") ? "Granting…" : "Grant pass"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}


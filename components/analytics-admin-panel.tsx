"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Award, BarChart3, RefreshCw, Users } from "lucide-react";
import { readJsonResponse } from "@/lib/http";

type CourseMetric = {
  slug: string;
  title: string;
  completions: number;
  certificateDownloads: number;
};

type TrendPoint = {
  day: string;
  completions: number;
  certificateDownloads: number;
};

type Analytics = {
  generatedAt: string;
  trackingAvailable: boolean;
  totals: {
    completedLearners: number;
    courseCompletions: number;
    certificateDownloads: number;
    activeCourses: number;
  };
  courses: CourseMetric[];
  trend: TrendPoint[];
};

/** Formats a YYYY-MM-DD day as a short UTC date label. */
function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

/** Renders one analytics total with icon, value, and detail. */
function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Users; label: string; value: number; detail: string; tone: string }) {
  return (
    <div className="surface rounded-xl p-5">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
    </div>
  );
}

/** Admin analytics dashboard with totals, trend, and per-course metrics. */
export function AnalyticsAdminPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Loads course analytics from the admin API. */
  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/analytics", { cache: "no-store" });
      const result = (await readJsonResponse<Analytics & { error?: string }>(response)) ?? ({} as Analytics & { error?: string });
      if (!response.ok) throw new Error(result.error || "Could not load analytics.");
      setAnalytics(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAnalytics(); }, []);

  const maxTrendValue = useMemo(() => Math.max(1, ...(analytics?.trend || []).flatMap((point) => [point.completions, point.certificateDownloads])), [analytics]);
  const maxCourseValue = useMemo(() => Math.max(1, ...(analytics?.courses || []).flatMap((course) => [course.completions, course.certificateDownloads])), [analytics]);

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/c8f2x9/k7m3" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Admin dashboard</Link>
            <p className="label-text mt-6 text-[var(--patina)]">Performance overview</p>
            <h1 className="display-type mt-2 text-4xl sm:text-5xl">Course analytics</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Track how learners move through courses and how often completed certificates are downloaded.</p>
          </div>
          <button type="button" onClick={() => void loadAnalytics()} disabled={loading} className="button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? <p className="mt-6 rounded-xl border border-red-900/20 bg-red-900/5 px-4 py-3 text-sm font-semibold text-red-900" role="alert">{error}</p> : null}
        {loading && !analytics ? <p className="mt-10 text-sm text-[var(--muted)]">Loading analytics…</p> : null}

        {analytics ? (
          <>
            {!analytics.trackingAvailable ? <p className="mt-6 rounded-xl border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-4 py-3 text-sm font-semibold text-[var(--ink)]" role="status">Certificate download tracking is waiting for the Supabase analytics migration. Apply <code className="rounded bg-black/10 px-1.5 py-0.5 text-xs">supabase/analytics.sql</code> once, then refresh.</p> : null}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard icon={Users} label="Completed learners" value={analytics.totals.completedLearners} detail={`${analytics.totals.courseCompletions} course completions in total`} tone="bg-[var(--patina)]/12 text-[var(--patina)]" />
              <StatCard icon={Award} label="Certificate downloads" value={analytics.totals.certificateDownloads} detail="Successful certificate download events" tone="bg-[var(--brass)]/15 text-[var(--brass)]" />
              <StatCard icon={Activity} label="Courses with activity" value={analytics.totals.activeCourses} detail="Courses with a completion or download" tone="bg-[var(--oxblood)]/10 text-[var(--oxblood)]" />
            </div>

            <section className="surface mt-6 rounded-xl p-5 sm:p-6" aria-labelledby="trend-heading">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="label-text text-[var(--brass)]">Last 14 days</p>
                  <h2 id="trend-heading" className="display-type mt-1 text-2xl">Activity trend</h2>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--patina)]" /> Completions</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--brass)]" /> Downloads</span>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-7 gap-2 sm:grid-cols-14" aria-label="Fourteen day completion and certificate download trend">
                {analytics.trend.map((point) => (
                  <div key={point.day} className="group min-w-0 text-center">
                    <div className="flex h-44 items-end justify-center gap-1 rounded-lg bg-black/[0.025] px-1 pb-2 pt-3 sm:h-52">
                      <div className="w-1/2 rounded-t bg-[var(--patina)] transition-all" style={{ height: `${Math.max(point.completions ? 7 : 2, (point.completions / maxTrendValue) * 100)}%` }} title={`${point.completions} completions`} />
                      <div className="w-1/2 rounded-t bg-[var(--brass)] transition-all" style={{ height: `${Math.max(point.certificateDownloads ? 7 : 2, (point.certificateDownloads / maxTrendValue) * 100)}%` }} title={`${point.certificateDownloads} certificate downloads`} />
                    </div>
                    <p className="mt-2 truncate text-[10px] font-semibold text-[var(--muted)]">{shortDate(point.day)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface mt-6 rounded-xl p-5 sm:p-6" aria-labelledby="course-metrics-heading">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="label-text text-[var(--patina)]">Course breakdown</p>
                  <h2 id="course-metrics-heading" className="display-type mt-1 text-2xl">Completions and downloads</h2>
                </div>
                <BarChart3 className="h-6 w-6 text-[var(--muted)]" />
              </div>
              {analytics.courses.length > 0 ? (
                <div className="mt-6 space-y-5">
                  {analytics.courses.map((course) => (
                    <div key={course.slug}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-bold text-[var(--ink)]">{course.title}</span>
                        <span className="text-xs font-semibold text-[var(--muted)]">{course.completions} completions · {course.certificateDownloads} downloads</span>
                      </div>
                      <div className="mt-2 grid gap-1.5">
                        <div className="flex items-center gap-2"><span className="w-20 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Complete</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--patina)]" style={{ width: `${(course.completions / maxCourseValue) * 100}%` }} /></div></div>
                        <div className="flex items-center gap-2"><span className="w-20 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Download</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--brass)]" style={{ width: `${(course.certificateDownloads / maxCourseValue) * 100}%` }} /></div></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-6 rounded-xl bg-black/[0.03] px-4 py-6 text-center text-sm text-[var(--muted)]">No course activity has been recorded yet.</p>}
            </section>

            <p className="mt-5 text-right text-xs text-[var(--muted)]">Updated {new Date(analytics.generatedAt).toLocaleString()}</p>
          </>
        ) : null}
      </div>
    </main>
  );
}

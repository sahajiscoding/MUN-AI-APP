import { ApiError, jsonError } from "@/lib/api";
import { courses } from "@/lib/courses";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayKey(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isMissingAnalyticsTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("certificate_downloads") || false;
}

function lastDays(count: number) {
  const days: string[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - offset);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    // 10k-row scans per call: throttle per admin identity.
    if (!(await checkRateLimit(`admin-analytics:${admin.uid}`, 30, 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again later.");
    }
    const db = supabaseAdmin();
    const [progressResult, downloadResult] = await Promise.all([
      db
        .from("course_progress")
        .select("uid, course_slug, completed_lessons, completed_at")
        .limit(10000),
      db
        .from("certificate_downloads")
        .select("course_slug, downloaded_at")
        .order("downloaded_at", { ascending: false })
        .limit(10000),
    ]);

    if (progressResult.error) throw progressResult.error;
    const trackingAvailable = !downloadResult.error || !isMissingAnalyticsTable(downloadResult.error);
    if (downloadResult.error && trackingAvailable) throw downloadResult.error;
    const downloadRows = trackingAvailable ? downloadResult.data || [] : [];

    const courseBySlug = new Map(courses.map((course) => [course.slug, course]));
    const completionByCourse = new Map<string, number>();
    const completedLearners = new Set<string>();
    const downloadByCourse = new Map<string, number>();
    const completionByDay = new Map<string, number>();
    const downloadByDay = new Map<string, number>();

    for (const row of progressResult.data || []) {
      const course = courseBySlug.get(row.course_slug);
      const lessons = Array.isArray(row.completed_lessons) ? row.completed_lessons : [];
      const complete = !!course && course.lessons.every((_, index) => lessons.includes(index));
      if (!complete) continue;
      completionByCourse.set(row.course_slug, (completionByCourse.get(row.course_slug) || 0) + 1);
      completedLearners.add(row.uid);
      const day = dayKey(row.completed_at);
      if (day) completionByDay.set(day, (completionByDay.get(day) || 0) + 1);
    }

    for (const row of downloadRows) {
      downloadByCourse.set(row.course_slug, (downloadByCourse.get(row.course_slug) || 0) + 1);
      const day = dayKey(row.downloaded_at);
      if (day) downloadByDay.set(day, (downloadByDay.get(day) || 0) + 1);
    }

    const courseMetrics = courses
      .map((course) => ({
        slug: course.slug,
        title: course.title,
        completions: completionByCourse.get(course.slug) || 0,
        certificateDownloads: downloadByCourse.get(course.slug) || 0,
      }))
      .filter((course) => course.completions > 0 || course.certificateDownloads > 0)
      .sort((left, right) => right.completions - left.completions || right.certificateDownloads - left.certificateDownloads);

    const days = lastDays(14);
    const trend = days.map((day) => ({
      day,
      completions: completionByDay.get(day) || 0,
      certificateDownloads: downloadByDay.get(day) || 0,
    }));

    return Response.json({
      generatedAt: new Date().toISOString(),
      trackingAvailable,
      totals: {
        completedLearners: completedLearners.size,
        courseCompletions: Array.from(completionByCourse.values()).reduce((total, value) => total + value, 0),
        certificateDownloads: Array.from(downloadByCourse.values()).reduce((total, value) => total + value, 0),
        activeCourses: courseMetrics.length,
      },
      courses: courseMetrics,
      trend,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

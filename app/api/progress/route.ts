import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { getCourseBySlug } from "@/lib/courses";
import { quizzes } from "@/lib/quizzes";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";

const getSchema = z.object({
  course_slug: z.string().trim().min(1).max(120),
});

const upsertSchema = z.object({
  course_slug: z.string().trim().min(1).max(120),
  completed_lessons: z.array(z.number().int().min(0)).max(200),
  quiz_score: z.number().int().min(0).optional(),
  quiz_total: z.number().int().min(0).optional(),
  completed_at: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const course_slug = searchParams.get("course_slug");

    if (course_slug) {
      const parsedCourse = getSchema.safeParse({ course_slug });
      if (!parsedCourse.success || !getCourseBySlug(course_slug)) {
        throw new ApiError(400, "invalid_course", "That course does not exist.");
      }

      // Get progress for one course
      const { data } = await supabaseAdmin()
        .from("course_progress")
        .select("course_slug, completed_lessons, quiz_score, quiz_total, completed_at, updated_at")
        .eq("uid", user.uid)
        .eq("course_slug", course_slug)
        .single();

      return Response.json({ progress: data || null });
    }

    // Get all course progress
    const { data } = await supabaseAdmin()
      .from("course_progress")
      .select("course_slug, completed_lessons, quiz_score, quiz_total, completed_at")
      .eq("uid", user.uid);

    return Response.json({ progress: data || [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await parseJson<unknown>(request);
    const parsed = upsertSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(400, "invalid_progress", "Invalid progress data.");
    }

    const { course_slug, completed_lessons, quiz_score, quiz_total, completed_at } = parsed.data;
    const course = getCourseBySlug(course_slug);
    if (!course) {
      throw new ApiError(400, "invalid_course", "That course does not exist.");
    }

    const uniqueLessons = new Set(completed_lessons);
    if (
      uniqueLessons.size !== completed_lessons.length ||
      completed_lessons.some((index) => index >= course.lessons.length)
    ) {
      throw new ApiError(400, "invalid_lessons", "One or more lesson indexes are invalid.");
    }

    const quizLength = Math.max(quizzes[course_slug]?.length ?? 0, course.lessons.length);
    if (
      (quiz_total ?? 0) > quizLength ||
      (quiz_score ?? 0) > (quiz_total ?? 0)
    ) {
      throw new ApiError(400, "invalid_quiz_score", "The quiz score is invalid.");
    }

    const { error } = await supabaseAdmin().from("course_progress").upsert(
      {
        uid: user.uid,
        course_slug,
        completed_lessons,
        quiz_score: quiz_score ?? 0,
        quiz_total: quiz_total ?? 0,
        completed_at: completed_at || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "uid,course_slug" }
    );

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

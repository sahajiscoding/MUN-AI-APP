import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { getCourseBySlug } from "@/lib/courses";
import { buildTrustedCourseReviewQuestions } from "@/lib/server/course-progress";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const getSchema = z.object({
  course_slug: z.string().trim().min(1).max(120),
});

const upsertSchema = z.object({
  course_slug: z.string().trim().min(1).max(120),
  completed_lessons: z.array(z.number().int().min(0)).max(200).optional(),
  quizAnswers: z.array(z.number().int().min(0)).max(200).optional(),
}).refine(
  (body) => body.completed_lessons !== undefined || body.quizAnswers !== undefined,
  { message: "Provide progress to save." }
);

/** GET /api/progress — returns the authenticated user's course progress. */
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
        .select("course_slug, completed_lessons, quiz_score, quiz_total, quiz_verified_at, completed_at, updated_at")
        .eq("uid", user.uid)
        .eq("course_slug", course_slug)
        .single();

      return Response.json({ progress: data || null });
    }

    // Get all course progress
    const { data } = await supabaseAdmin()
      .from("course_progress")
      .select("course_slug, completed_lessons, quiz_score, quiz_total, quiz_verified_at, completed_at")
      .eq("uid", user.uid);

    return Response.json({ progress: data || [] });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/progress — saves completed lessons and grades the final review. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await parseJson<unknown>(request);
    const parsed = upsertSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(400, "invalid_progress", "Invalid progress data.");
    }

    const { course_slug, completed_lessons, quizAnswers } = parsed.data;
    const course = getCourseBySlug(course_slug);
    if (!course) {
      throw new ApiError(400, "invalid_course", "That course does not exist.");
    }

    // The stored row is the source of truth for anything not sent in this
    // call, so checkpoint saves never clobber a recorded quiz result and
    // quiz submissions never drop completed lessons.
    const { data: existing, error: existingError } = await supabaseAdmin()
      .from("course_progress")
      .select("completed_lessons, quiz_score, quiz_total, quiz_verified_at, completed_at")
      .eq("uid", user.uid)
      .eq("course_slug", course_slug)
      .maybeSingle();
    if (existingError) throw existingError;

    const storedLessons = Array.isArray(existing?.completed_lessons)
      ? (existing.completed_lessons as number[]).filter((index) => Number.isInteger(index) && index >= 0)
      : [];

    let lessons = storedLessons;
    if (completed_lessons !== undefined) {
      const uniqueLessons = new Set(completed_lessons);
      if (
        uniqueLessons.size !== completed_lessons.length ||
        completed_lessons.some((index) => index >= course.lessons.length)
      ) {
        throw new ApiError(400, "invalid_lessons", "One or more lesson indexes are invalid.");
      }
      // Lessons are earned exclusively through /api/progress/checkpoint,
      // which verifies each answer server-side. This bulk endpoint may
      // re-assert already-earned lessons but must never grant new ones —
      // otherwise clients could self-attest completion and bypass every
      // checkpoint (certificate forgery).
      const storedSet = new Set(storedLessons);
      const novel = completed_lessons.filter((index) => !storedSet.has(index));
      if (novel.length > 0) {
        throw new ApiError(
          400,
          "lessons_require_checkpoint",
          "Complete each lesson through its checkpoint before saving progress here."
        );
      }
      lessons = [...uniqueLessons].sort((a, b) => a - b);
    }

    let quizScore = Number(existing?.quiz_score) || 0;
    let quizTotal = Number(existing?.quiz_total) || 0;
    let quizVerifiedAt = typeof existing?.quiz_verified_at === "string" ? existing.quiz_verified_at : null;
    let graded: { score: number; total: number; passed: boolean } | null = null;

    // Final-review submissions are graded here, server-side, against the same
    // question list the client renders. Self-reported scores are never accepted.
    // The aggregate score response still leaks one bit per submission
    // (hill-climbing), so submissions are tightly budgeted per user+course.
    if (quizAnswers !== undefined) {
      if (!(await checkRateLimit(`progress-quiz:${user.uid}:${course_slug}`, 5, 10 * 60_000))) {
        throw new ApiError(429, "rate_limited", "Too many review submissions. Wait a few minutes and try again.");
      }
      const questions = buildTrustedCourseReviewQuestions(course);
      if (quizAnswers.length !== questions.length) {
        throw new ApiError(400, "invalid_quiz_answers", "Your review answers could not be verified. Please retake the final review.");
      }
      for (let index = 0; index < quizAnswers.length; index += 1) {
        if (quizAnswers[index] >= questions[index].options.length) {
          throw new ApiError(400, "invalid_quiz_answers", "Your review answers could not be verified. Please retake the final review.");
        }
      }

      const score = questions.reduce(
        (total, question, index) => total + (quizAnswers[index] === question.correct ? 1 : 0),
        0
      );
      const passed = questions.length > 0 && score / questions.length >= 0.7;
      graded = { score, total: questions.length, passed };
      quizScore = score;
      quizTotal = questions.length;
      if (passed) quizVerifiedAt = new Date().toISOString();
    }

    const allLessonsComplete =
      course.lessons.length > 0 &&
      lessons.length === course.lessons.length &&
      course.lessons.every((_, index) => lessons.includes(index));
    const quizPassed = quizVerifiedAt !== null;
    const completed = allLessonsComplete && quizPassed;
    const completedAt = completed
      ? (typeof existing?.completed_at === "string" ? existing.completed_at : new Date().toISOString())
      : null;

    const { error } = await supabaseAdmin().from("course_progress").upsert(
      {
        uid: user.uid,
        course_slug,
        completed_lessons: lessons,
        quiz_score: quizScore,
        quiz_total: quizTotal,
        quiz_verified_at: quizVerifiedAt,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "uid,course_slug" }
    );

    if (error) throw error;

    return Response.json({ ok: true, ...(graded ? { quiz: graded } : {}) });
  } catch (error) {
    return jsonError(error);
  }
}

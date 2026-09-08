import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTrustedCourse, getTrustedQuestions, normalizeLessonIndexes, isSequentiallyComplete } from "@/lib/server/course-progress";

export const runtime = "nodejs";

const schema = z.object({
  course_slug: z.string().trim().min(1).max(120),
  lesson_index: z.number().int().min(0).max(200),
  answer_index: z.number().int().min(0).max(20),
}).strict();

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new ApiError(400, "invalid_checkpoint", "Invalid lesson checkpoint.");

    const { course_slug, lesson_index, answer_index } = parsed.data;
    const course = getTrustedCourse(course_slug);
    const questions = getTrustedQuestions(course_slug);
    if (!course || !questions[lesson_index]) throw new ApiError(400, "invalid_course", "That course does not exist.");

    const { data: current, error: readError } = await supabaseAdmin()
      .from("course_progress")
      .select("completed_lessons, quiz_score, quiz_total, completed_at")
      .eq("uid", user.uid)
      .eq("course_slug", course_slug)
      .maybeSingle();
    if (readError) throw readError;

    const completedLessons = normalizeLessonIndexes(current?.completed_lessons, course.lessons.length);
    if (!isSequentiallyComplete(completedLessons, lesson_index)) {
      throw new ApiError(409, "lesson_locked", "Complete the earlier lessons before unlocking this checkpoint.");
    }
    if (questions[lesson_index].correct !== answer_index) {
      return Response.json({ ok: false, correct: false, completed_lessons: completedLessons }, { status: 422 });
    }

    const nextLessons = [...new Set([...completedLessons, lesson_index])].sort((a, b) => a - b);
    const complete = nextLessons.length === course.lessons.length;
    const { error: writeError } = await supabaseAdmin().from("course_progress").upsert({
      uid: user.uid,
      course_slug,
      completed_lessons: nextLessons,
      quiz_score: current?.quiz_score ?? 0,
      quiz_total: current?.quiz_total ?? 0,
      completed_at: complete ? (current?.completed_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid,course_slug" });
    if (writeError) throw writeError;

    return Response.json({ ok: true, correct: true, completed_lessons: nextLessons, completed: complete });
  } catch (error) {
    return jsonError(error);
  }
}

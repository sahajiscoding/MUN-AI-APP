import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTrustedCourse, getTrustedQuestions, normalizeLessonIndexes } from "@/lib/server/course-progress";

export const runtime = "nodejs";

const schema = z.object({
  course_slug: z.string().trim().min(1).max(120),
  answers: z.array(z.number().int().min(0).max(20)).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new ApiError(400, "invalid_final_review", "Invalid final review answers.");

    const { course_slug, answers } = parsed.data;
    const course = getTrustedCourse(course_slug);
    const questions = getTrustedQuestions(course_slug);
    if (!course || questions.length === 0) throw new ApiError(400, "invalid_course", "That course does not exist.");

    const { data: current, error: readError } = await supabaseAdmin()
      .from("course_progress")
      .select("completed_lessons")
      .eq("uid", user.uid)
      .eq("course_slug", course_slug)
      .maybeSingle();
    if (readError) throw readError;

    const completedLessons = normalizeLessonIndexes(current?.completed_lessons, course.lessons.length);
    if (completedLessons.length !== course.lessons.length) {
      throw new ApiError(409, "course_incomplete", "Complete every lesson before taking the final review.");
    }
    if (answers.length !== questions.length) throw new ApiError(400, "invalid_final_review", "Answer every final review question.");

    const score = questions.reduce((total, question, index) => total + (answers[index] === question.correct ? 1 : 0), 0);
    const { error: writeError } = await supabaseAdmin().from("course_progress").upsert({
      uid: user.uid,
      course_slug,
      completed_lessons: completedLessons,
      quiz_score: score,
      quiz_total: questions.length,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid,course_slug" });
    if (writeError) throw writeError;

    return Response.json({ ok: true, score, total: questions.length, passed: score / questions.length >= 0.7 });
  } catch (error) {
    return jsonError(error);
  }
}

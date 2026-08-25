import { z } from "zod";
import { jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";

const getSchema = z.object({
  course_slug: z.string().min(1),
});

const upsertSchema = z.object({
  course_slug: z.string().min(1),
  completed_lessons: z.array(z.number()),
  quiz_score: z.number().optional(),
  quiz_total: z.number().optional(),
  completed_at: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const course_slug = searchParams.get("course_slug");

    if (course_slug) {
      // Get progress for one course
      const { data } = await supabaseAdmin()
        .from("course_progress")
        .select("*")
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
      return jsonError(new Error("Invalid progress data."));
    }

    const { course_slug, completed_lessons, quiz_score, quiz_total, completed_at } = parsed.data;

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

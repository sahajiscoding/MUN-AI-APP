import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const profileSchema = z.object({
  school: z.string().trim().max(160).default(""),
  grade: z.string().trim().max(80).default(""),
  experienceLevel: z.enum(["first-timer", "beginner", "intermediate", "advanced"]),
  country: z.string().trim().max(120).default(""),
  committee: z.string().trim().max(160).default(""),
  agenda: z.string().trim().max(2000).default(""),
  conferenceDate: z.string().trim().max(10).regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(""),
  goals: z.string().trim().max(2000).default(""),
}).strict();

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { data, error } = await supabaseAdmin()
      .from("delegate_profiles")
      .select("school, grade, experience_level, country, committee, agenda, conference_date, goals, updated_at")
      .eq("uid", user.uid)
      .maybeSingle();

    if (error) throw error;
    return Response.json({
      profile: data
        ? {
            school: data.school ?? "",
            grade: data.grade ?? "",
            experienceLevel: data.experience_level ?? "intermediate",
            country: data.country ?? "",
            committee: data.committee ?? "",
            agenda: data.agenda ?? "",
            conferenceDate: data.conference_date ?? "",
            goals: data.goals ?? "",
          }
        : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = profileSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) {
      throw new ApiError(400, "invalid_profile", "Please check the profile fields and try again.");
    }

    const profile = parsed.data;
    const { error } = await supabaseAdmin().from("delegate_profiles").upsert(
      {
        uid: user.uid,
        school: profile.school,
        grade: profile.grade,
        experience_level: profile.experienceLevel,
        country: profile.country,
        committee: profile.committee,
        agenda: profile.agenda,
        conference_date: profile.conferenceDate || null,
        goals: profile.goals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "uid" }
    );

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

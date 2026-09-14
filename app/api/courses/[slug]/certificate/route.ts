import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { getCourseBySlug } from "@/lib/courses";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const slugSchema = z.string().trim().min(1).max(120);
const customizationSchema = z.object({
  // Extra fields (such as the legacy user-supplied signature) are stripped;
  // only the student's own name may be customized.
  name: z.string().trim().min(1).max(80).optional(),
});

function safePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function certificateId(uid: string, slug: string) {
  const input = `${uid}:${slug}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `MUN-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 18)}-${(hash >>> 0).toString(36).toUpperCase()}`;
}

async function generateCertificate(
  request: Request,
  params: Promise<{ slug: string }>,
  customization: z.infer<typeof customizationSchema> = {}
) {
  const user = await requireUser(request);
  // Bound CPU-heavy PDF rendering: 10 generations per minute per user.
  if (!(await checkRateLimit(`certificate:${user.uid}`, 10, 60_000))) {
    throw new ApiError(429, "rate_limited", "Too many certificate requests. Please wait a minute and try again.");
  }
  const { slug: rawSlug } = await params;
  const parsedSlug = slugSchema.safeParse(rawSlug);
  if (!parsedSlug.success) throw new ApiError(400, "invalid_course", "That course does not exist.");

  const slug = parsedSlug.data;
  const course = getCourseBySlug(slug);
  if (!course) throw new ApiError(404, "course_not_found", "That course does not exist.");

  const { data: progress, error } = await supabaseAdmin()
    .from("course_progress")
    .select("completed_lessons, quiz_score, quiz_total, quiz_verified_at, completed_at")
    .eq("uid", user.uid)
    .eq("course_slug", slug)
    .maybeSingle();

  if (error) throw error;

  const completedLessons = Array.isArray(progress?.completed_lessons)
    ? (progress.completed_lessons as number[])
    : [];
  const completedSet = new Set(completedLessons);

  // A certificate requires every lesson plus a server-verified passing final
  // review. quiz_verified_at is only written by the grading server route, so
  // self-reported scores can never unlock a certificate.
  const quizVerified = typeof progress?.quiz_verified_at === "string" && progress.quiz_verified_at.length > 0;
  const quizTotal = Number(progress?.quiz_total) || 0;
  const quizScore = Number(progress?.quiz_score) || 0;
  const isComplete =
    course.lessons.every((_, index) => completedSet.has(index)) &&
    quizVerified &&
    quizTotal > 0 &&
    quizScore / quizTotal >= 0.7;

  if (!isComplete) {
    throw new ApiError(403, "course_incomplete", "Complete every lesson and pass the final review before downloading your certificate.");
  }

  const displayName = safePdfText(customization.name || user.name || user.email?.split("@")[0] || "Delegate") || "Delegate";
  const signature = "MUN Prep Faculty";
  const courseTitle = safePdfText(course.title);
  const date = formatDate(progress?.completed_at);
  const id = certificateId(user.uid, slug);

  const { error: trackingError } = await supabaseAdmin().from("certificate_downloads").insert({
    uid: user.uid,
    course_slug: slug,
  });
  if (trackingError) {
    // Certificate delivery should remain available if analytics storage is
    // temporarily unavailable; the admin dashboard can still use completions.
    console.error("Could not record certificate download analytics", trackingError);
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([792, 612]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const paper = rgb(0.965, 0.95, 0.89);
  const ink = rgb(0.12, 0.12, 0.11);
  const patina = rgb(0.11, 0.44, 0.41);
  const brass = rgb(0.72, 0.54, 0.25);
  const muted = rgb(0.35, 0.34, 0.30);

  page.drawRectangle({ x: 0, y: 0, width: 792, height: 612, color: paper });
  page.drawRectangle({ x: 24, y: 24, width: 744, height: 564, borderColor: ink, borderWidth: 1.25 });
  page.drawRectangle({ x: 34, y: 34, width: 724, height: 544, borderColor: brass, borderWidth: 0.8 });
  page.drawRectangle({ x: 66, y: 510, width: 660, height: 4, color: patina });

  page.drawText("MUN PREP", { x: 66, y: 544, size: 15, font: bold, color: patina });
  page.drawText("CERTIFICATE OF COMPLETION", { x: 66, y: 452, size: 31, font: bold, color: ink });
  page.drawText("This certificate is proudly presented to", { x: 66, y: 412, size: 14, font: italic, color: muted });

  const nameSize = displayName.length > 28 ? 27 : 34;
  page.drawText(displayName, { x: 66, y: 354, size: nameSize, font: bold, color: ink });
  page.drawRectangle({ x: 66, y: 340, width: 660, height: 1.5, color: brass });

  page.drawText("for successfully completing the course", { x: 66, y: 306, size: 14, font: regular, color: muted });
  const titleSize = courseTitle.length > 38 ? 23 : 28;
  page.drawText(courseTitle, { x: 66, y: 264, size: titleSize, font: bold, color: patina });
  page.drawText(`Completed on ${date}`, { x: 66, y: 204, size: 13, font: regular, color: muted });

  const signatureSize = signature.length > 22 ? 10 : 12;
  page.drawText(signature, { x: 562, y: 145, size: signatureSize, font: italic, color: ink });
  page.drawRectangle({ x: 530, y: 132, width: 196, height: 1, color: brass });
  page.drawText("Signature", { x: 530, y: 116, size: 9, font: bold, color: muted });

  page.drawText("Certificate ID", { x: 66, y: 112, size: 9, font: bold, color: muted });
  page.drawText(id, { x: 66, y: 94, size: 11, font: regular, color: ink });
  page.drawText("MUN Prep · Learn, practise, lead", { x: 514, y: 94, size: 10, font: italic, color: patina });

  const pdfBytes = await pdf.save();
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mun-prep-${slug}-certificate.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    return await generateCertificate(request, context.params);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const customization = customizationSchema.parse(await parseJson<unknown>(request));
    return await generateCertificate(request, context.params, customization);
  } catch (error) {
    return jsonError(error);
  }
}

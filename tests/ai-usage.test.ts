import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAIUsage } from "../lib/ai/types";
import { actualUsageOrFallback, estimateAiReservation } from "../lib/server/ai-usage-logic";

describe("AI daily usage logic", () => {
  it("normalizes provider usage and derives a missing total", () => {
    expect(normalizeAIUsage({ prompt_tokens: 120, completion_tokens: 30 })).toEqual({
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
    });
  });

  it("prefers authoritative provider totals over fallback estimates", () => {
    expect(actualUsageOrFallback({ totalTokens: 5400 }, 8000)).toBe(5400);
  });

  it("uses a non-negative fallback when provider usage is absent or invalid", () => {
    expect(actualUsageOrFallback(undefined, 8000)).toBe(8000);
    expect(actualUsageOrFallback({ totalTokens: -1 }, 8000)).toBe(8000);
    expect(actualUsageOrFallback({ totalTokens: 1.5 }, 8000)).toBe(8000);
  });

  it("bounds a reservation by the configured daily limit", () => {
    expect(estimateAiReservation({
      prompt: "A".repeat(50_000),
      committee: "General",
      country: "Any",
      experienceLevel: "intermediate",
      priorTurns: [{ content: "B".repeat(50_000) }],
      maxTokens: 8_000,
      limit: 100_000,
    })).toBe(100_000);
  });

  it("includes prior conversation context in the reservation", () => {
    const short = estimateAiReservation({
      prompt: "Write a speech",
      committee: "General",
      country: "Any",
      experienceLevel: "intermediate",
      priorTurns: [],
      maxTokens: 2_600,
      limit: 100_000,
    });
    const long = estimateAiReservation({
      prompt: "Write a speech",
      committee: "General",
      country: "Any",
      experienceLevel: "intermediate",
      priorTurns: [{ content: "Earlier planning context".repeat(100) }],
      maxTokens: 2_600,
      limit: 100_000,
    });
    expect(long).toBeGreaterThan(short);
  });
});

describe("AI usage migration contract", () => {
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260826_ai_usage_daily.sql"), "utf8");

  it("uses one UTC-date row per authenticated UID and denies browser table access", () => {
    expect(migration).toContain("unique (uid, usage_date)");
    expect(migration).toContain("now() at time zone 'utc'");
    expect(migration).toContain("revoke all on table public.ai_usage_daily from anon, authenticated");
    expect(migration).toContain("revoke all on table public.ai_usage_reservations from anon, authenticated");
  });

  it("tracks each reservation by UUID and makes terminal states no-ops", () => {
    expect(migration).toContain("create table if not exists public.ai_usage_reservations");
    expect(migration).toContain("status text not null default 'pending'");
    expect(migration).toContain("if reservation_status <> 'pending' then");
    expect(migration).toContain("p_reservation_id uuid");
  });

  it("provides atomic reserve, reconcile, and release functions", () => {
    expect(migration).toContain("create or replace function public.reserve_ai_tokens");
    expect(migration).toContain("create or replace function public.reconcile_ai_tokens");
    expect(migration).toContain("create or replace function public.release_ai_tokens");
    expect(migration).toContain("for update");
  });
});

"use client";

import { Save } from "lucide-react";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";

type ProfileState = {
  school: string;
  grade: string;
  experienceLevel: string;
  country: string;
  committee: string;
  agenda: string;
  conferenceDate: string;
  goals: string;
};

const initialProfile: ProfileState = {
  school: "",
  grade: "",
  experienceLevel: "intermediate",
  country: "",
  committee: "",
  agenda: "",
  conferenceDate: "",
  goals: "",
};

export function ProfileForm() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(initialProfile);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) {
        return;
      }

      const { data } = await getSupabase()
        .from("delegate_profiles")
        .select("*")
        .eq("uid", user.id)
        .single();

      if (!cancelled && data) {
        setProfile({
          school: data.school ?? "",
          grade: data.grade ?? "",
          experienceLevel: data.experience_level ?? "intermediate",
          country: data.country ?? "",
          committee: data.committee ?? "",
          agenda: data.agenda ?? "",
          conferenceDate: data.conference_date ?? "",
          goals: data.goals ?? "",
        });
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const { error } = await getSupabase().from("delegate_profiles").upsert(
        {
          uid: user.id,
          school: profile.school,
          grade: profile.grade,
          experience_level: profile.experienceLevel,
          country: profile.country,
          committee: profile.committee,
          agenda: profile.agenda,
          conference_date: profile.conferenceDate,
          goals: profile.goals,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "uid" }
      );

      if (error) {
        throw error;
      }

      setStatus("Profile saved.");
    } catch {
      setStatus("Could not save profile. Check Supabase setup or RLS policies.");
    } finally {
      setSaving(false);
    }
  }

  function updateField<Key extends keyof ProfileState>(key: Key, value: ProfileState[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <form className="surface rounded-panel p-5 sm:p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="School">
          <input
            className="input-field mt-2"
            value={profile.school}
            onChange={(event) => updateField("school", event.target.value)}
          />
        </Field>
        <Field label="Grade">
          <input
            className="input-field mt-2"
            value={profile.grade}
            onChange={(event) => updateField("grade", event.target.value)}
          />
        </Field>
        <Field label="Experience">
          <select
            className="input-field mt-2"
            value={profile.experienceLevel}
            onChange={(event) => updateField("experienceLevel", event.target.value)}
          >
            <option value="first-timer">First timer</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
        <Field label="Country">
          <input
            className="input-field mt-2"
            value={profile.country}
            onChange={(event) => updateField("country", event.target.value)}
            placeholder="India, France, Brazil..."
          />
        </Field>
        <Field label="Committee">
          <input
            className="input-field mt-2"
            value={profile.committee}
            onChange={(event) => updateField("committee", event.target.value)}
            placeholder="UNHRC, UNSC, WHO..."
          />
        </Field>
        <Field label="Conference date">
          <input
            className="input-field mt-2"
            value={profile.conferenceDate}
            onChange={(event) => updateField("conferenceDate", event.target.value)}
            type="date"
          />
        </Field>
        <Field label="Agenda">
          <textarea
            className="input-field mt-2 min-h-28 resize-y md:col-span-2"
            value={profile.agenda}
            onChange={(event) => updateField("agenda", event.target.value)}
            placeholder="Agenda topic or crisis arc"
          />
        </Field>
        <Field label="Prep goals">
          <textarea
            className="input-field mt-2 min-h-28 resize-y md:col-span-2"
            value={profile.goals}
            onChange={(event) => updateField("goals", event.target.value)}
            placeholder="Awards, research depth, confidence in speeches..."
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">{status || "Saved to your Supabase account."}</p>
        <button className="button-primary inline-flex items-center justify-center gap-2 px-4 font-semibold" type="submit">
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-text">{label}</span>
      {children}
    </label>
  );
}

"use client";

import { useEffect, useState } from "react";

const KEY = "mun_cookie_preferences";

/** Cookie preference control storing the optional choice locally. */
export function CookiePreferences() {
  const [optional, setOptional] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setOptional(window.localStorage.getItem(KEY) === "enabled");
  }, []);

  /** Saves the optional cookie preference to local storage. */
  function save() {
    window.localStorage.setItem(KEY, optional ? "enabled" : "disabled");
    setSaved(true);
    window.setTimeout(() => { setSaved(false); }, 2200);
  }

  return <div className="mt-8 rounded-xl border border-[var(--line)] bg-white/40 p-5"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={optional} onChange={(event) => { setOptional(event.target.checked); }} className="mt-1 h-4 w-4 accent-[var(--patina)]" /><span><strong className="block text-sm">Allow optional preferences</strong><span className="mt-1 block text-sm leading-6 text-[var(--muted)]">This choice is stored only in this browser. Essential sign-in and security cookies remain enabled.</span></span></label><button type="button" onClick={save} className="button-primary mt-5 px-4 py-2 text-sm font-semibold">{saved ? "Preferences saved" : "Save preferences"}</button></div>;
}

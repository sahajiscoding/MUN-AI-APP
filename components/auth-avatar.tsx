"use client";

import { useEffect, useRef, useState } from "react";
import { createAvatar } from "@bible-strong/avatar-react";
import type { AvatarDefinition } from "@bible-strong/avatar-core";
import muniAvatarJson from "@/lib/avatars/muni.avatar.json";
import { cn } from "@/lib/utils";

export type AvatarField = "name" | "email" | "password" | null;
export type AvatarStatus = "idle" | "error" | "success";

type AuthAvatarProps = {
  activeField: AvatarField;
  /** true while the user is actively typing in any field */
  isTyping: boolean;
  status: AvatarStatus;
  /** length of the email value — Muni gets curious as it grows */
  emailLength?: number;
  /** md: compact (above forms) · xl: hero stage (auth side panel) */
  size?: "md" | "xl";
  className?: string;
};

/**
 * Muni — a cute MUN delegate blob for the auth pages, rendered with the
 * procedural avatar engine from bible-strong-avatar-lab
 * (AGPL-3.0-only, © Stéphane Montlouis-Calixte).
 *
 * The character definition in `@/lib/avatars/muni.avatar.json` was authored
 * for this project (original geometry, expressions and animations) and is
 * played back by `@bible-strong/avatar-react`, which also owns blinking and
 * reduced-motion handling.
 *
 * Behaviors (same contract as before):
 * - the whole character leans/tilts smoothly toward the pointer (fine
 *   pointers only); on touch it watches the focused field instead
 * - typing switches to the excited typing loop; the wrapper keeps its bounce
 * - password focus switches to the shy loop (downcast, coy, eyes fluttering
 *   shut) with a deeper blush
 * - success plays the happy loop plus the celebration bounce; error plays
 *   the sad loop plus the shake
 * - blink timing is built into every animation definition
 */
const MuniAvatar = createAvatar(muniAvatarJson as unknown as AvatarDefinition);

type AuthAnimation =
  | "idle"
  | "typing"
  | "shy"
  | "happy"
  | "sad"
  | "curious"
  | "listening";

function pickAnimation(
  activeField: AvatarField,
  isTyping: boolean,
  status: AvatarStatus,
  emailLength: number,
): AuthAnimation {
  if (status === "success") return "happy";
  if (status === "error") return "sad";
  if (activeField === "password") return "shy";
  if (isTyping) return "typing";
  if (activeField === "email" || emailLength > 24) return "curious";
  if (activeField === "name") return "listening";
  return "idle";
}

export function AuthAvatar({
  activeField,
  isTyping,
  status,
  emailLength = 0,
  size = "md",
  className,
}: AuthAvatarProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);
  const followTarget = useRef({ x: 0, y: 0 });

  const animation = pickAnimation(activeField, isTyping, status, emailLength);
  const happy = status === "success";
  const sad = status === "error";
  const shy = activeField === "password";
  const pixelSize = size === "xl" ? 288 : 160;

  // Pointer follow — desktop only, so touch users get field-focus behavior.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    function onMove(event: PointerEvent) {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.42;
      const dx = (event.clientX - cx) / 220;
      const dy = (event.clientY - cy) / 220;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(1, len);
      followTarget.current = {
        x: (dx / len) * clamped,
        // bias slightly downward: the form sits below the avatar
        y: (dy / len) * clamped * 0.9 + 0.18,
      };
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Smooth-follow loop (skipped for reduced motion).
  useEffect(() => {
    if (reduced) {
      setFollow({ ...followTarget.current });
      return;
    }
    let frame = 0;
    const tick = () => {
      setFollow((prev) => {
        const t = followTarget.current;
        const nx = prev.x + (t.x - prev.x) * 0.12;
        const ny = prev.y + (t.y - prev.y) * 0.12;
        if (Math.abs(nx - prev.x) < 0.001 && Math.abs(ny - prev.y) < 0.001) return prev;
        return { x: nx, y: ny };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  const tiltX = reduced ? 0 : follow.x * 5;
  const tiltRotate = reduced ? 0 : follow.x * 4;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "flex select-none flex-col items-center",
        sad && "avatar-shake",
        happy && !reduced && "avatar-happy",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn("pointer-events-none relative", !reduced && "avatar-float")}
        style={{ transform: `translateX(${tiltX}px) rotate(${tiltRotate}deg)` }}
      >
        {/* twinkling sparkles around the mascot */}
        {!reduced && (
          <>
            <span
              className="avatar-twinkle absolute -left-2 top-2 text-[#E9C46A]"
              style={{ animationDelay: "0s" }}
            >
              ✦
            </span>
            <span
              className="avatar-twinkle absolute -right-3 top-8 text-[#E9C46A]"
              style={{ animationDelay: "1.1s" }}
            >
              ✦
            </span>
            <span
              className="avatar-twinkle absolute -bottom-1 right-2 text-[#E9C46A]"
              style={{ animationDelay: "2s" }}
            >
              ✦
            </span>
          </>
        )}

        <MuniAvatar
          animation={animation}
          size={pixelSize}
          ariaLabel="Muni, a cute delegate blob mascot that follows your cursor"
          className={cn(!reduced && isTyping && !happy && !sad && "avatar-bounce")}
        />

        {/* ground shadow */}
        <div
          className="mx-auto -mt-3 h-2.5 w-1/2 rounded-full bg-[rgba(23,20,18,0.14)] blur-[2px]"
          aria-hidden="true"
        />
        {shy && (
          <p className="mt-1 text-center text-xs font-semibold text-[var(--muted)]">
            Muni is looking away…
          </p>
        )}
      </div>
    </div>
  );
}

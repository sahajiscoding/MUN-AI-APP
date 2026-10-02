"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type AvatarField = "name" | "email" | "password" | null;
export type AvatarStatus = "idle" | "error" | "success";

type AuthAvatarProps = {
  activeField: AvatarField;
  /** true while the user is actively typing in any field */
  isTyping: boolean;
  status: AvatarStatus;
  /** length of the email value — pupils get curious as it grows */
  emailLength?: number;
  /** md: compact (above forms) · xl: hero stage (auth side panel) */
  size?: "md" | "xl";
  className?: string;
};

/**
 * Original playful blob mascot for the auth pages.
 *
 * Inspired by the *idea* of cursor-tracking login avatars (see
 * bible-strong-avatar-lab for the general concept) but drawn and animated
 * from scratch — no code copied from that AGPL-3.0 project.
 *
 * Behaviors:
 * - pupils + head tilt smoothly follow the pointer (fine pointers only)
 * - on touch / coarse pointers it looks toward the focused field instead
 * - auto-blinks every few seconds
 * - bounces + opens its mouth while typing
 * - covers its eyes with paws when the password field is focused
 * - happy bounce on success, sad shake on error
 */
export function AuthAvatar({
  activeField,
  isTyping,
  status,
  emailLength = 0,
  size = "md",
  className,
}: AuthAvatarProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0.25 });
  const [blinking, setBlinking] = useState(false);
  const [reduced, setReduced] = useState(false);
  const lookTarget = useRef({ x: 0, y: 0.25 });

  // Pointer tracking — desktop only, so touch users get field-focus gaze.
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
      lookTarget.current = {
        x: (dx / len) * clamped,
        // bias slightly downward: the form sits below the avatar
        y: (dy / len) * clamped * 0.9 + 0.18,
      };
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Field-focus gaze — also the fallback for touch devices.
  useEffect(() => {
    if (activeField === "password") {
      lookTarget.current = { x: 0, y: 0.55 };
    } else if (activeField === "email") {
      lookTarget.current = { x: 0, y: 0.35 };
    } else if (activeField === "name") {
      lookTarget.current = { x: -0.25, y: 0.3 };
    } else {
      lookTarget.current = { x: 0, y: 0.18 };
    }
    // On coarse pointers, snap directly (no cursor to blend with).
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setLook({ ...lookTarget.current });
    }
  }, [activeField]);

  // Smooth-follow loop (skipped for reduced motion).
  useEffect(() => {
    if (reduced) {
      setLook({ ...lookTarget.current });
      return;
    }
    let frame = 0;
    const tick = () => {
      setLook((prev) => {
        const t = lookTarget.current;
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

  // Auto-blink.
  useEffect(() => {
    if (reduced) return;
    let timeout = 0;
    let closed = 0;
    const schedule = () => {
      timeout = window.setTimeout(
        () => {
          setBlinking(true);
          closed = window.setTimeout(() => {
            setBlinking(false);
            schedule();
          }, 140);
        },
        2400 + Math.random() * 3200,
      );
    };
    schedule();
    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(closed);
    };
  }, [reduced]);

  const shy = activeField === "password";
  const happy = status === "success";
  const sad = status === "error";

  // Pupil travel (px inside the SVG) + head tilt from the same vector.
  const px = reduced ? 0 : look.x * 7;
  const py = reduced ? 0 : Math.max(-5, Math.min(6, look.y * 6));
  const headDx = reduced ? 0 : look.x * 5;
  const headRotate = reduced ? 0 : look.x * 4;
  const curiosity = Math.min(1, emailLength / 24);
  const pupilR = 10.5 + curiosity * 1.8 - (blinking ? 9 : 0);
  const waving = isTyping && !reduced && !happy && !sad;

  const caption = happy
    ? "Yay — let's go!"
    : sad
      ? "Oops — try again?"
      : shy
        ? isTyping
          ? "No peeking…"
          : "Shy — password time!"
        : activeField === "email"
          ? isTyping
            ? "Nice typing…"
            : "I'm watching you type…"
          : activeField === "name"
            ? "Hello, delegate!"
            : "Eyes on you…";

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
        className={cn("pointer-events-none", !reduced && "avatar-float")}
        style={{ transform: `translateX(${headDx}px)` }}
      >
        <svg
          viewBox="0 0 200 176"
          className={cn(
            size === "xl"
              ? "h-60 w-60 sm:h-72 sm:w-72 xl:h-80 xl:w-80"
              : "h-36 w-36 sm:h-40 sm:w-40",
            !reduced && isTyping && !happy && !sad && "avatar-bounce",
          )}
          role="img"
          aria-label="Playful blob mascot that follows your cursor"
        >
          {/* ground shadow */}
          <ellipse cx="100" cy="164" rx="52" ry="8" fill="rgba(23,20,18,0.14)" />

          {/* twinkling sparkles around the mascot */}
          {!reduced && (
            <g fill="#E9C46A">
              <path className="avatar-twinkle" style={{ animationDelay: "0s" }} d="M30 34 l2.2 5.8 5.8 2.2 -5.8 2.2 -2.2 5.8 -2.2 -5.8 -5.8 -2.2 5.8 -2.2 Z" />
              <path className="avatar-twinkle" style={{ animationDelay: "1.1s" }} d="M170 44 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 Z" />
              <path className="avatar-twinkle" style={{ animationDelay: "2s" }} d="M160 142 l1.5 3.8 3.8 1.5 -3.8 1.5 -1.5 3.8 -1.5 -3.8 -3.8 -1.5 3.8 -1.5 Z" />
            </g>
          )}

          <g style={{ transform: `rotate(${headRotate}deg)`, transformBox: "fill-box", transformOrigin: "center" }}>
            {/* stubby arms — wave while typing, shy-fold on password */}
            <g
              className={cn(waving && "avatar-wave-left")}
              style={{ transformBox: "fill-box", transformOrigin: "top center" }}
            >
              <ellipse
                cx="32"
                cy="112"
                rx="10"
                ry="17"
                fill="#2A7F78"
                stroke="#171412"
                strokeWidth="4"
                style={{
                  transform: shy ? "translate(14px, -18px) rotate(28deg)" : "none",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transition: "transform 220ms ease",
                }}
              />
            </g>
            <g
              className={cn(waving && "avatar-wave-right")}
              style={{ transformBox: "fill-box", transformOrigin: "top center" }}
            >
              <ellipse
                cx="168"
                cy="112"
                rx="10"
                ry="17"
                fill="#2A7F78"
                stroke="#171412"
                strokeWidth="4"
                style={{
                  transform: shy ? "translate(-14px, -18px) rotate(-28deg)" : "none",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transition: "transform 220ms ease",
                }}
              />
            </g>

            {/* body */}
            <ellipse cx="100" cy="92" rx="68" ry="62" fill="#3AA99E" />
            <ellipse cx="100" cy="92" rx="68" ry="62" fill="none" stroke="#171412" strokeWidth="5" />
            {/* belly */}
            <ellipse cx="100" cy="118" rx="40" ry="30" fill="#F7F3EA" opacity="0.9" />
            {/* head nubs with shine */}
            <circle cx="62" cy="44" r="12" fill="#3AA99E" stroke="#171412" strokeWidth="5" />
            <circle cx="138" cy="44" r="12" fill="#3AA99E" stroke="#171412" strokeWidth="5" />
            <circle cx="58" cy="40" r="3" fill="#F7F3EA" opacity="0.8" />
            <circle cx="134" cy="40" r="3" fill="#F7F3EA" opacity="0.8" />

            {/* chubby blush */}
            <ellipse cx="50" cy="108" rx="13" ry="8.5" fill="#E07856" opacity={shy ? 0.9 : 0.55} />
            <ellipse cx="150" cy="108" rx="13" ry="8.5" fill="#E07856" opacity={shy ? 0.9 : 0.55} />

            {/* big glossy eyes */}
            <g
              style={{
                transform: blinking ? "scaleY(0.08)" : "scaleY(1)",
                transformBox: "fill-box",
                transformOrigin: "center",
                transition: "transform 120ms ease",
              }}
            >
              <ellipse cx="72" cy="84" rx="24" ry="26" fill="#fff" stroke="#171412" strokeWidth="4" />
              <ellipse cx="128" cy="84" rx="24" ry="26" fill="#fff" stroke="#171412" strokeWidth="4" />
              <g style={{ transform: `translate(${px}px, ${py}px)` }}>
                <circle cx="72" cy="87" r={pupilR} fill="#171412" />
                <circle cx="128" cy="87" r={pupilR} fill="#171412" />
                {!blinking && (
                  <>
                    <circle cx={74} cy={82} r="4" fill="#fff" />
                    <circle cx={130} cy={82} r="4" fill="#fff" />
                    <circle cx={79} cy={90} r="1.6" fill="#fff" opacity="0.9" />
                    <circle cx={135} cy={90} r="1.6" fill="#fff" opacity="0.9" />
                  </>
                )}
              </g>
              {happy && !blinking && (
                <g stroke="#F7F3EA" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M63 74 l5 5 M68 74 l-5 5" />
                  <path d="M132 74 l5 5 M137 74 l-5 5" />
                </g>
              )}
            </g>

            {/* brows — lift when typing, knit when error */}
            <g
              stroke="#171412"
              strokeWidth="4.5"
              strokeLinecap="round"
              style={{
                transform: sad ? "translateY(3px)" : isTyping ? "translateY(-3px)" : "none",
                transition: "transform 180ms ease",
              }}
            >
              <path d={sad ? "M56 60 L86 66" : "M56 62 L86 58"} fill="none" />
              <path d={sad ? "M144 60 L114 66" : "M144 62 L114 58"} fill="none" />
            </g>

            {/* mouth */}
            {happy ? (
              <g>
                <ellipse cx="100" cy="122" rx="17" ry="13" fill="#171412" />
                <ellipse cx="100" cy="126" rx="9" ry="5.5" fill="#E07856" />
              </g>
            ) : sad ? (
              <path d="M84 130 Q100 118 116 130" fill="none" stroke="#171412" strokeWidth="4.5" strokeLinecap="round" />
            ) : isTyping ? (
              <ellipse cx="100" cy="122" rx={9 + curiosity * 3} ry="11" fill="#171412" />
            ) : shy ? (
              <path d="M92 122 L108 122" stroke="#171412" strokeWidth="4.5" strokeLinecap="round" />
            ) : (
              <path d="M84 118 Q100 130 116 118" fill="none" stroke="#171412" strokeWidth="4.5" strokeLinecap="round" />
            )}

            {/* shy paws slide over the eyes on password focus */}
            <g
              style={{
                opacity: shy ? 1 : 0,
                transform: shy ? "translateY(0)" : "translateY(46px)",
                transition: "transform 220ms ease, opacity 200ms ease",
              }}
            >
              <ellipse cx="72" cy="86" rx="25" ry="20" fill="#2A7F78" stroke="#171412" strokeWidth="4" />
              <ellipse cx="128" cy="86" rx="25" ry="20" fill="#2A7F78" stroke="#171412" strokeWidth="4" />
              <path d="M64 80 L64 92 M72 78 L72 94 M80 80 L80 92" stroke="#171412" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M120 80 L120 92 M128 78 L128 94 M136 80 L136 92" stroke="#171412" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>

      {/* reactive caption */}
      <p
        className={cn(
          "rounded-full border backdrop-blur-sm",
          size === "xl"
            ? "mt-3 border-white/15 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/80"
            : "mt-1 border-[var(--line)] bg-[var(--control-bg)] px-3 py-1 text-xs font-semibold text-[var(--muted)]",
        )}
        role="status"
      >
        {caption}
      </p>
    </div>
  );
}

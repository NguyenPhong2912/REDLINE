import type { CSSProperties } from "react";

// The design language, in one place.
//
// Functional screens stay bright and quiet; the cinematic landing page supplies
// the atmosphere. This keeps operational data calm and easy to scan.

export const color = {
  bg: "#f3f7fd",
  surface: "rgba(255,255,255,0.92)",
  surfaceSubtle: "#f7faff",
  surfaceInset: "#edf3fb",

  border: "#dbe5f2",
  borderStrong: "#b9cbe0",

  // Every value below clears WCAG AA (4.5:1) against surfaceInset, the darkest
  // ground here — so it clears on all of them. That bar is not decoration:
  // these are status colours on 10–11px type, and the reason codes they carry
  // are the most important words on the screen. The hues are the cool palette
  // this interface was designed around; only their luminance is constrained.
  text: "#182033",        // 14.6:1
  textSecondary: "#44526a", // 7.1:1
  textMuted: "#4f5f7b",   // 5.8:1
  textDim: "#5f6e85",     // 4.6:1 — the lightest type this theme permits

  primary: "#1461f5",
  primaryText: "#2065e6",

  // Reserved meanings.
  info: "#1c778b",
  warn: "#93641a",
  danger: "#d12746",
  success: "#1d7b57",

  onAccent: "#ffffff",
} as const;

// The live feed is intentionally cooler than the surrounding graphite so it
// still reads as a console inside the control room.
export const term = {
  bg: "#0d1117",
  head: "#f1f3f6",
  text: "#c9d1d9",
  // Lifted to clear AA against term.bg. The timestamp column and the quieter
  // event lines are still type someone has to read, and a console is exactly
  // where "atmospheric" grey usually stops being legible.
  dim: "#8b96a5",
  faint: "#7c8797",
  success: "#3fb950",
  info: "#58a6ff",
  warn: "#d29922",
  danger: "#f85149",
} as const;

/** Accent tint for a fill — small alpha, enough to read as a state. */
export const tint = (hex: string, alpha = 0.08) => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
};

export const mono: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
export const sans: CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };

/** A layered card with restrained depth and no expensive backdrop blur. */
export const panel = (extra?: CSSProperties): CSSProperties => ({
  background: color.surface,
  border: `1px solid ${color.border}`,
  boxShadow: "0 18px 48px rgba(76, 104, 148, 0.10)",
  ...extra,
});

/** A nested region inside a card: a step down, never another shadow. */
export const inset = (extra?: CSSProperties): CSSProperties => ({
  background: color.surfaceSubtle,
  border: `1px solid ${color.border}`,
  ...extra,
});

/** A status chip in one of the reserved meanings. */
export const chip = (c: string): CSSProperties => ({
  background: tint(c, 0.09),
  color: c,
  border: `1px solid ${tint(c, 0.22)}`,
});

import type { CSSProperties } from "react";

// The design language, in one place.
//
// One language, not two. These tokens and src/styles/index.css describe the
// same cool blue-grey daylight palette, so a screen drawn from inline styles
// and one drawn from the stylesheet belong to the same product. They have
// disagreed twice; when they do, every route change looks like a different
// application.
//
// Saturation is rationed. Almost everything is a near-neutral, so a refusal is
// the only loud thing on screen.
//
// Every value is checked against `bg`, the darkest ground here, and therefore
// clears WCAG AA on the lighter ones too. That bar is not decoration — these
// are status colours on 11-13px type, and the reason codes they carry are the
// most important words on the page.

export const color = {
  bg: "#cbd5df",
  surface: "#e2e8ee",
  surfaceSubtle: "#d8e0e8",
  surfaceInset: "#cbd6e0",

  border: "#aebdcb",
  borderStrong: "#8799ab",

  text: "#172330",
  textSecondary: "#34475a",
  textMuted: "#3f4e5e",
  textDim: "#4e5c69",

  primary: "#365f84",
  primaryText: "#294f73",

  info: "#356166",
  warn: "#7d500d",
  danger: "#a92640",
  success: "#186649",

  onAccent: "#ffffff",
} as const;

// The live feed keeps its own slightly cooler ground so it still reads as a
// console rather than another panel. Its accents sit on `bg`; the header bar
// takes color.surfaceSubtle from the panel around it.
export const term = {
  bg: "#d6dee6",
  text: "#223244",
  dim: "#465668",
  faint: "#546371",
  success: "#186649",
  info: "#24649b",
  warn: "#865710",
  danger: "#b0324c",
} as const;

/** Accent tint for a fill — small alpha, enough to read as a state. */
export const tint = (hex: string, alpha = 0.14) => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
};

export const mono: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
export const sans: CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };

/** A card: a lift out of the page, a hairline, and depth from shadow. */
export const panel = (extra?: CSSProperties): CSSProperties => ({
  background: color.surface,
  border: `1px solid ${color.border}`,
  boxShadow: "0 18px 48px rgba(62, 101, 155, 0.10)",
  ...extra,
});

/** A nested region inside a card: a step up, never another shadow. */
export const inset = (extra?: CSSProperties): CSSProperties => ({
  background: color.surfaceSubtle,
  border: `1px solid ${color.border}`,
  ...extra,
});

/** A status chip in one of the reserved meanings. */
export const chip = (c: string): CSSProperties => ({
  background: tint(c, 0.16),
  color: c,
  border: `1px solid ${tint(c, 0.34)}`,
});

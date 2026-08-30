import type { CSSProperties } from "react";

// The design language, in one place.
//
// One language, not two. The landing page is built in src/styles/index.css
// around a violet-and-cyan night palette; the functional screens used to be
// light blue, and the two fought each other on every route change. These
// tokens are that same night palette, so a page built from inline styles and
// a page built from the stylesheet now belong to the same product.
//
// Saturation is still rationed. Almost everything is a neutral drawn from the
// violet family, so a refusal is the only loud thing on screen.
//
// Every value is checked against the most raised surface (surfaceInset); it
// therefore clears WCAG AA on the darker grounds too. That bar is not
// decoration — these are status colours on 10-11px type, and the reason codes
// they carry are the most important words here.

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
// console rather than another panel.
export const term = {
  bg: "#d6dee6",
  head: "#c9d4de",
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

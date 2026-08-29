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
  // Grounds, deepest first. bg is what index.css paints on html/body.
  bg: "#07060d",
  surface: "#120b24",
  surfaceSubtle: "#19122b",
  surfaceInset: "#29233e",

  // Hairlines. On a dark ground a border is a lightening, not a darkening.
  border: "#29233e",
  borderStrong: "#3b3357",

  // Text, four steps of emphasis.
  text: "#f7f4ff",          // 13.8:1
  textSecondary: "#c4b5fd", // 8.1:1
  textMuted: "#aaa2c4",     // 6.2:1
  textDim: "#928baa",       // 4.6:1 — the dimmest type this theme permits

  // Violet leads; it is the colour the landing page opens with.
  primary: "#a78bfa",       // 5.5:1
  primaryText: "#c4b5fd",

  // Reserved meanings.
  info: "#22d3ee",          // 8.3:1
  warn: "#d9952a",          // 5.9:1
  danger: "#e77f92",        // 5.6:1
  success: "#5eead4",       // 10.1:1

  // Type that sits on a filled accent, not on a ground.
  onAccent: "#120b24",
} as const;

// The live feed keeps its own slightly cooler ground so it still reads as a
// console rather than another panel.
export const term = {
  bg: "#0d0b16",
  head: "#19122b",
  text: "#e6e1f5",
  dim: "#a09ab8",
  faint: "#8d86a6",
  success: "#5eead4",
  info: "#22d3ee",
  warn: "#f0b755",
  danger: "#f28ba0",
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
  boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)",
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

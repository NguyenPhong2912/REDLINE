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
  bg: "#EBF0FF",
  canvasDeep: "#EBF0FF",
  surface: "#ffffff",
  surfaceSubtle: "#ffffff",
  surfaceInset: "#f1f5f9",

  border: "#cbd5e1",
  borderStrong: "#94a3b8",

  text: "#0f172a",         // --color-ink (tiêu đề + dữ liệu quan trọng nhất)
  textSecondary: "#1e293b",
  textMuted: "#334155",     // --color-ink-muted (mô tả phụ >= 4.5:1 WCAG AA) — darkened a step so body copy reads as ink, not haze
  textDim: "#54637a",

  primary: "#2563eb",
  primaryText: "#1d4ed8",

  info: "#3b82f6",         // --color-info
  verified: "#0f766e",     // --color-verified (qua cổng / ALLOW / khớp on-chain)
  blocked: "#b45309",      // --color-blocked (bị chặn / BLOCK / evidence lệch)
  warn: "#b45309",
  danger: "#b45309",
  success: "#0f766e",

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

// Radiant accents — decorative light only (glow, gradient stops, live
// indicators). Never assign these as flat text color: they aren't checked
// against `bg` the way the palette above is, because a glow next to a
// pixel isn't a word inside it.
export const glow = {
  cyan: "#22d3ee",
  violet: "#a78bfa",
  primaryBright: "#38bdf8",
} as const;

/** A soft radiant glow for CTAs and live status accents. */
export const glowShadow = (hex: string, alpha = 0.45, blur = 26): string =>
  `0 0 ${blur}px ${tint(hex, alpha)}`;

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

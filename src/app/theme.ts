import type { CSSProperties } from "react";

// The design language, in one place.
//
// REDLINE argues that a limit is enforced rather than promised, and that the
// record of it can be checked by a stranger. The audience is a treasury
// operator who has to justify a decision to an auditor. Neon on black reads as
// crypto-native; this reads as an instrument — light, dense, quiet, closer to
// a statement than a dashboard.
//
// One rule carries the product's message: saturation is rationed. Almost
// everything is neutral, so the refusals are the only loud thing on screen.
// When the chain says no, the page says it too, and nothing else competes.

export const color = {
  // Surfaces — paper, not white, so long reading does not glare.
  bg: "#f6f7f9",
  surface: "#ffffff",
  surfaceSubtle: "#f1f3f6",
  surfaceInset: "#eceff3",

  // Hairlines. Borders do the work that glow used to.
  border: "#e3e7ed",
  borderStrong: "#ccd3dd",

  // Text, four steps of emphasis. On a dark ground "dimmer" just means darker
  // and can go as far as it likes; on a light one it means lighter, and there
  // is a floor. Every step here clears WCAG AA (4.5:1) against the *darkest*
  // ground below, because almost all of this UI sets type at 10–11px and the
  // large-text concession does not apply. Lightening any of them past this
  // point trades legibility for nothing.
  text: "#0f172a",        // 16.1:1
  textSecondary: "#4f5258", // 7.1:1
  textMuted: "#5e6169",   // 5.6:1
  textDim: "#6a6d75",     // 4.7:1 — the lightest type this theme permits

  // One primary. Teal keeps a thread to what this was without shouting.
  primary: "#0f766e",
  primaryText: "#0b5f58",

  // Reserved meanings.
  info: "#0369a1",
  warn: "#8a5406",
  danger: "#b91c1c",
  success: "#15803d",

  onAccent: "#ffffff",
} as const;

// The live feed is the one dark surface left, on purpose: a stream of runtime
// events reads as a console, and one anchored dark block on a light page is a
// familiar pattern rather than a leftover. It needs its own accents — the
// light-ground colours above are far too dark to sit on it.
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

/** A card. Flat, hairline, one soft shadow — no blur, no gradient, no glow. */
export const panel = (extra?: CSSProperties): CSSProperties => ({
  background: color.surface,
  border: `1px solid ${color.border}`,
  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
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

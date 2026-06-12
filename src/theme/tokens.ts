import { Easing } from 'react-native-reanimated';

// ──────────────────────────────────────────────────────────────────────────────
// The ONE place to change the look of the app.
//
// space / radii / fontSize / borderWidth are RN points (plain numbers).
// Every color, size, radius, border, opacity and motion value the UI uses lives
// here — components must never inline a raw hex / number. Add a token instead.
//
// Design system: warm light theme is the hero; dark is adapted from it. Indigo is
// the hero accent (the 10% in 60-30-10) — exactly one filled indigo element per
// screen + the active nav state. Amber is the true accent, reserved strictly for
// honey / ripen / reward / optimism semantics. Neutrals carry the 60 + 30.
// ──────────────────────────────────────────────────────────────────────────────

export const tokens = {
  // 4-based rhythm + two sub-8 micro steps (kills inline gap: 2/3/6).
  space: { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },

  // One honest radius set with clear semantics — every CARD uses `card`.
  //   sm   tags / small chips
  //   md   inputs, segmented controls
  //   card all cards (one value, no exceptions)
  //   sheet modals / bottom sheets
  //   full true pills, FAB, dots, the tab indicator
  radii: { none: 0, sm: 8, md: 12, card: 16, sheet: 20, full: 999 },

  borderWidth: { hairline: 1, thin: 1.5, thick: 2 },

  // Replaces scattered 0.3 / 0.4 / 0.6 opacities.
  opacity: { disabled: 0.4, pressed: 0.6 },

  // The numeric type scale — typography.ts (the role layer) derives every role
  // size from these, so the whole scale is editable in one place.
  fontSize: {
    xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, '2xl': 30, '3xl': 38,
    // finer steps the role scale needs
    micro: 11.5, caption: 12.5, bodySm: 14, bodyLg: 16, subtitle: 22, title: 26, honest: 40, timer: 78,
  },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  fontFamily: { ui: 'System', mono: 'Menlo' },
  lineHeight: { tight: 1.15, normal: 1.4, relaxed: 1.6 },

  // Soft elevation for raised/focal cards (CSS box-shadow renders cross-platform).
  shadow: {
    sm: { offset: 3, opacity: 1, radius: 0 },
    md: { offset: 6, opacity: 1, radius: 0 },
  },

  // Honeycomb cell geometry — flat-top hexagon WIDTH (point-to-point across the
  // flats) per surface. Height derives as width × √3/2 in the component, so the
  // hexes stay regular. strip = the Today HUD; hub = the Whenbee grid; detail =
  // the category screen. The wax-cap rim width also lives here.
  honeycomb: { strip: 22, hub: 56, detail: 80, capRim: 1.5 },

  motion: {
    fast: 120, base: 220, slow: 360, press: 110, reveal: 600, draw: 950, sheet: 340,
    pulse: 700, toast: 300, honeyFill: 900, float: 3800,
    // Shared physics — deduped from AppButton + FAB.
    spring: { damping: 13, stiffness: 340 },
    // Named curves — declared once, not re-typed per file.
    easing: { standard: Easing.bezier(0.4, 0, 0.2, 1), calm: Easing.inOut(Easing.sin) },
  },

  colors: {
    light: {
      // ── 3-step surface ladder (figure/ground: each step lifts clearly) ──
      bg: '#F4F1EA', // cream (page ground — the 60%)
      surface: '#FFFFFF', // card — lifts off the cream
      surfaceRaised: '#FFFFFF', // focal card (pair with soft shadow)
      surfaceSunken: '#ECE8DE', // wells / inset tracks
      hairline: '#DAD5C9', // 1px internal dividers (reads at 3:1 non-text)
      border: '#CFC9BA', // stronger edge for cards that must read

      // ── ink ramp (text) ──
      ink: '#20233A', // primary text (AA on every surface)
      inkSoft: '#5C5F73', // muted text — AA (≥4.5:1) on white + cream
      inkFaint: '#9B9DAB', // ≤3:1, non-essential hairline labels ONLY

      // ── accents (indigo hero / amber true accent) ──
      primary: '#6B5BE6',
      primaryEdge: '#463B9E',
      primarySoft: '#E4E0FA', // low-emphasis indigo fill
      accent: '#EEAE4D',
      accentEdge: '#C68A30',
      accentSoft: '#FBEFD6', // low-emphasis amber fill
      amberText: '#8A5A12', // AA amber-on-light text
      success: '#33B07C',
      successSoft: '#E2F4EA',
      danger: '#D14343',

      // ── utility ──
      scrim: 'rgba(20,21,29,0.45)', // modal/sheet overlay
      shadowSoft: 'rgba(32,35,58,0.12)',
      // Inverse pill (toasts) — always the OPPOSITE of the mode so it pops:
      // light mode → dark pill + warm-white text.
      inverseSurface: '#1C1E2E',
      inverseText: '#F4F1EA',
      night: '#1C1E2E', // dark chip on light (aha card)
      nightSoft: '#2C2E40',
      onIndigo: '#FFFFFF', // text on indigo fill (AA 5.1:1 — warm white only hit 4.37)
      onAmber: '#20233A', // text on amber fill (AA 7.9:1)

      // ── backward-compat aliases (template keys) ──
      text: '#20233A',
      textMuted: '#5C5F73',
      primaryText: '#F4F1EA',
      paper: '#F4F1EA',
    },
    dark: {
      // ── 3-step surface ladder (deeper, clearer steps — less navy soup) ──
      bg: '#14151D',
      surface: '#1F2130',
      surfaceRaised: '#292B3C',
      surfaceSunken: '#15161F',
      hairline: 'rgba(255,255,255,0.08)', // internal dividers only
      border: 'rgba(255,255,255,0.14)', // cards that must read

      // ── ink ramp ──
      ink: '#F4F1EA',
      inkSoft: '#ADA9B5', // solid (off the old 62% alpha) — AA on surface + bg
      inkFaint: 'rgba(244,241,234,0.40)',

      // ── accents ──
      primary: '#8275F0',
      primaryEdge: '#6B5BE6',
      primarySoft: 'rgba(130,117,240,0.22)',
      accent: '#EEAE4D',
      accentEdge: '#C68A30',
      accentSoft: 'rgba(238,174,77,0.18)',
      amberText: '#EEAE4D',
      success: '#33B07C',
      successSoft: 'rgba(51,176,124,0.18)',
      danger: '#E06464',

      // ── utility ──
      scrim: 'rgba(10,11,16,0.60)',
      shadowSoft: 'rgba(0,0,0,0.45)',
      // dark mode → light pill + dark text, so the toast reads against the deep bg.
      inverseSurface: '#ECE8DE',
      inverseText: '#20233A',
      night: '#1C1E2E',
      nightSoft: '#2C2E40',
      onIndigo: '#14151D', // dark text on the lighter dark-mode indigo (AA)
      onAmber: '#20233A',

      // ── backward-compat aliases ──
      text: '#F4F1EA',
      textMuted: '#ADA9B5',
      primaryText: '#14151D',
      paper: '#F4F1EA',
    },
  },
} as const;

export type ColorName = keyof typeof tokens.colors.light;
export type SpaceName = keyof typeof tokens.space;
export type RadiusKey = keyof typeof tokens.radii;

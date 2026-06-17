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
  // 4-based rhythm + sub-8 micro steps (kills inline gap: 2/3/6). 2.5:10 is the
  // half-step the chip vertical padding needs to clear the 44pt target.
  space: { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },

  // Control-height system — HIG-compliant touch targets (44pt floor). Buttons and
  // tappable controls size from here, so nothing is ad-hoc under the 44pt minimum.
  // `coin` = the FocusCard play affordance — a touch smaller than a full md control
  // so the disc reads as an accent, not a button competing with the card.
  // `shareCard` = fixed width of the off-screen ShareableCard captured to an image.
  // `timelineCol` = the tabular start–end time column width in the plan timeline
  // (one literal, reused by PlanTimeline + ShareableCard so the columns line up).
  size: { control: { sm: 36, md: 44, lg: 52 }, coin: 40, shareCard: 340, timelineCol: 110 },

  // Icon sizing scale — replaces inline 12/16/18/20/22/24/30 across the app.
  iconSize: { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 },

  // One honest radius set with clear semantics — every CARD uses `card`.
  //   sm   tags / small chips
  //   md   inputs, segmented controls
  //   card all cards (one value, no exceptions)
  //   sheet modals / bottom sheets
  //   full true pills, FAB, dots, the tab indicator
  radii: { none: 0, sm: 8, md: 12, card: 16, sheet: 20, full: 999 },

  // `card` is the ONE knob for every card's edge — change it once to restyle (or
  // set 0 to remove) all card borders app-wide. hairline/thin/thick stay for
  // dividers, inputs and accent edges, so tuning cards never disturbs them.
  // borderWidth: { hairline: 1, thin: 1.5, thick: 2, card: 1 },
  // `share` = the ShareableCard's defined 1px edge. It is kept OFF the global card
  // knob on purpose: a shared image needs a visible edge against any background,
  // even when in-app cards run borderless.
  borderWidth: { hairline: 0, thin: 0, thick: 2, card: 0, share: 1 },

  // Replaces scattered 0.3 / 0.4 / 0.6 opacities.
  opacity: { disabled: 0.4, pressed: 0.6 },

  // Tactile scale feedback for tappable controls (chips, segments).
  //   pressIn — finger-down dip; the control yields to the touch (only while held).
  scale: { pressIn: 0.96 },

  // The numeric type scale — typography.ts (the role layer) derives every role
  // size from these, so the whole scale is editable in one place.
  fontSize: {
    '2xs': 8, xs: 10, sm: 12, base: 14, md: 16, lg: 20, xl: 24, '2xl': 30, '3xl': 38,
    // finer steps the role scale needs
    micro: 10, caption: 12, bodySm: 14, bodyLg: 16, subtitle: 22, title: 26, honest: 40, timerClock: 64, timer: 78,
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
  // `stripMax` caps how many combs the Today HUD shows before a "+N" overflow tail
  // (the row is bounded so the vertical card never grows / clips with many combs).
  // `pip` = the small SOLID hexagon used by the Today tier-progress meter (one pip
  // per log in the current tier band) — distinct from the honey-FILL `strip` cell.
  honeycomb: { strip: 22, hub: 56, detail: 80, pip: 15, capRim: 1.5, stripMax: 6 },

  // Progress-bar geometry (honey-fill track). `track` = bar height in RN points;
  // the fill reuses `radii.full` + `colors.accent`, the track `colors.surfaceSunken`.
  // gap* = the Today guess→plan calibration line (FocusCard / RunningFocusCard):
  //   gapTrack = bar height; tickW/tickH = the live elapsed marker riding the bar.
  progress: { track: 6, gapTrack: 8, tickW: 3, tickH: 16 },

  motion: {
    fast: 120, base: 220, slow: 360, press: 110, reveal: 600, draw: 950, sheet: 340,
    pulse: 700, toast: 300, honeyFill: 900, float: 3800,
    // stagger = per-item delay in a left→right cascade (honeycomb pip reveal). Keep
    // the whole cascade < ~500ms so it reads lively, not slow (motion-design budget).
    stagger: 40,
    // drift = one full revolution of the RayBurst sunburst. Slow enough to stay
    // calm, fast enough to read as clearly moving (a wedge passes ~every 0.8s).
    drift: 14000,
    // Shared physics — deduped from AppButton + FAB.
    spring: { damping: 13, stiffness: 340 },
    // Named curves — declared once, not re-typed per file.
    easing: { standard: Easing.bezier(0.4, 0, 0.2, 1), calm: Easing.inOut(Easing.sin) },
  },

  colors: {
    light: {
      // ── 3-step surface ladder (figure/ground: each step lifts clearly) ──
      // bg: '#F4F1EA', // cream (page ground — the 60%)
      bg: '#F4F2FC', // cream (page ground — the 60%)
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
      accentCoin: 'rgba(238,174,77,0.32)', // tint disc that still reads on accentSoft
      // RayBurst sunburst wedge fill. A deeper periwinkle than primarySoft so the
      // rays actually read on cream (primarySoft was near-invisible on the page bg).
      rayFill: '#BFB2F0',
      // Companion drift-health tint (amber/indigo only — never red). settled reuses
      // the amber accent (the calm, honey "all good"); curious reuses the indigo hero
      // (a gentle "worth a re-check" nudge, never a sad/wilt signal).
      driftSettled: '#EEAE4D', // = accent (amber)
      driftCurious: '#6B5BE6', // = primary (indigo)
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
      accentCoin: 'rgba(238,174,77,0.28)', // tint disc that still reads on accentSoft
      // RayBurst wedge fill — indigo lifted just off the deep bg (the #8 look).
      rayFill: 'rgba(130,117,240,0.30)',
      // Companion drift-health tint (amber/indigo only — never red). Matches the
      // dark-mode accent / primary so the bee reads as the same companion in dark.
      driftSettled: '#EEAE4D', // = accent (amber)
      driftCurious: '#8275F0', // = primary (indigo, dark variant)
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

  // Bee-burst illustration geometry (RayBurst / CoinBadge / BeeBurst). Kept here so
  // no component inlines a raw px / opacity. `ray.opacity`/`opacityAlt` are the two
  // alternating sunburst-wedge fill opacities (applied to `colors.primarySoft`);
  // `countHero`/`countSoft` set wedge density per intensity. Float/bob/lift are the
  // gentle ambient travel distances; coinEdge is the button-edge depth (cf. AppButton).
  burst: {
    // ONE sunburst look everywhere (reward, paywall, hub) — the two alternating
    // wedge fill opacities applied to `colors.primarySoft`, at a single density.
    ray: { count: 18, opacity: 0.85, opacityAlt: 0.4 },
    stage: 240, // ray-burst stage edge (square)
    bee: 168, // mascot size inside a hero burst (fits the 240 stage → no layout push)
    stageReward: 190, // reward-modal stage — a calmer crest, not a hero (reward only)
    beeReward: 120, // reward-modal mascot size inside the 190 stage (reward only)
    beeFloat: 5, // ± vertical bee drift (calm ambient)
    coinBob: 3, // ± coin bob
    coinLift: 10, // coin mount-pop lift
    coinEdge: 4, // coin button-edge depth (cf. AppButton)
  },

  // Companion presence — the 6-stage Whenbee growth (Part 2 Group E). Both scales
  // are indexed by stage 1..6 (array index = stage - 1). They are pure geometry, so
  // they live mode-independent here (like `burst`); the per-stage DRIFT TINT colors
  // live in colors.light/dark below (settled = amber family, curious = indigo accent
  // — amber/indigo only, NEVER red). The bee only ever climbs: each stage adds glow
  // and float, none subtracts (monotonic by construction).
  companion: {
    // Ambient float-lift amplitude (± px) per stage — the calm vertical drift grows
    // with presence: a barely-there breath at Raw, a confident hover at Keeper.
    floatLift: [2, 3, 5, 7, 9, 11],
    // Soft glow radius (px) per stage. Stages 1–2 have none (a young bee is plain);
    // it blooms from Ripening on so the felt warmth tracks the comb sealing.
    glow: [0, 0, 6, 12, 18, 24],
  },

  // ── brand illustration palette ──────────────────────────────────────────────
  // Fixed art colors for the Whenbee mascot (BeeMascot). Brand art does NOT recolor
  // by mode — a mascot reads as the SAME bee in light and dark, the way a logo does.
  // Indigo body ≈ primary, amber stripes ≈ accent family, dark ink ≈ ink, but the
  // exact illustration shades (highlights/shadows/wing cream) live here so they are
  // token-sourced without polluting the semantic UI ramp.
  brand: {
    bee: {
      body: '#5F4EE4', // indigo body (≈ primary)
      bodyHi: '#6F60E7', // top highlight
      bodyLo: '#4F3CE2', // bottom shade
      stripe: '#F6B442', // amber band / head (≈ accent)
      stripeLo: '#EA980B', // head shadow (≈ accentEdge)
      wing: '#FCE7C5', // pale wing cream
      ink: '#262D40', // eyes / smile / stinger (≈ ink)
      antenna: '#191E2B', // antenna stalks + tips
      antennaHi: '#474B55', // antenna tip highlight
    },
  },
} as const;

export type ColorName = keyof typeof tokens.colors.light;
export type SpaceName = keyof typeof tokens.space;
export type RadiusKey = keyof typeof tokens.radii;

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
  // `planCardMin` = minimum row height for a build PlanTaskCard (≥ 44pt HIG floor).
  // `gripW` = width of each grip line in the drag handle.
  // `wheelCol` = width of the DurationWheel selector pill/column — wider than tall
  // so the centre highlight reads as a pill (not a circle) and fits "1h 35m".
  // `wheelRow` = inline wheel row height (Duration + FinishTime) — tighter than
  // control.sm so the faded neighbour numbers sit close to the selected pill.
  // `hitSlop` = extra tap area added via the Pressable hitSlop prop so that small
  // touch targets (secondary buttons, skip links) comfortably meet the 44pt HIG
  // floor without visually enlarging the element.
  size: { control: { xs: 32, sm: 36, md: 44, lg: 52 }, coin: 40, wheelCol: 72, wheelRow: 32, shareCard: 340, timelineCol: 110, planCardMin: 70, gripW: 14, hitSlop: 8, sparkline: 32 },

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
  borderWidth: { hairline: 0, thin: 0, thick: 2, card: 0, share: 1, chip: 1 },

  // Replaces scattered 0.3 / 0.4 / 0.6 opacities.
  opacity: { disabled: 0.4, pressed: 0.6, wash: 0.78 },

  // Onboarding aurora glow opacities (mode-independent alphas; colours come from colors.primary/primaryEdge).
  gradients: { backdropTop: 0.22, backdropCorner: 0.16 },

  // Tactile scale feedback for tappable controls (chips, segments, ghost button).
  //   pressIn — finger-down dip; the control yields to the touch (only while held).
  //   0.94 deepens the squeeze so the press reads as a real physical push.
  scale: { pressIn: 0.94 },

  // Coin-edge depth for FILLED pill buttons (AppButton indigo/amber). `edge` is how
  // far the darker bottom edge peeks below the pill at rest (the 3D thickness);
  // `drop` is how far the pill travels down onto that edge on press. drop < edge
  // leaves a 1pt sliver so the edge never fully disappears under the pill.
  depth: { edge: 8, drop: 7 },

  // The numeric type scale — typography.ts (the role layer) derives every role
  // size from these, so the whole scale is editable in one place.
  fontSize: {
    '2xs': 8, xs: 10, sm: 12, base: 14, md: 16, lg: 20, xl: 24, '2xl': 30, '3xl': 38,
    // finer steps the role scale needs
    micro: 10, caption: 12, bodySm: 14, bodyLg: 16, subtitle: 22, title: 26, honestLg: 36, honest: 40, timerClock: 64, timer: 78,
  },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  fontFamily: { ui: 'System', mono: 'Menlo' },
  lineHeight: { tight: 1.15, normal: 1.4, relaxed: 1.6 },
  // Tracking — negative values tighten display headings so they feel intentional
  // rather than loose. `tight` is the standard display-headline tightening.
  // M4: normal/wide added for plan-screen labels (PlanTaskCard "RUNNING" tag,
  // PlanRail now-pill text). tight stays for display headings.
  letterSpacing: { tight: -0.5, normal: 0.2, wide: 0.8 },

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
  progress: {
    track: 6, gapTrack: 8, tickW: 3, tickH: 16,
    // bandTrack = the category-detail hero range band height (a bolder strip than
    // the Add-Task gapTrack). caret = the convergence-point callout triangle that
    // floats above the band (w = base, h = height of the downward caret, overlap = 1px
    // optical overlap of the caret tip onto its pill).
    bandTrack: 16, caret: { w: 10, h: 6, overlap: 1 },
    // teaserFill = the fixed illustrative fill fraction on a LOCKED (non-Pro) goal
    // teaser track — it shows the SHAPE of progress, never the user's real data.
    teaserFill: 0.34,
    // gapStripe = the focus-card guess segment's diagonal hatch (indigo lines on
    // primarySoft). Tones the guess down from a solid indigo block so Start is the
    // single filled indigo on Today. lineW = stroke width, gapW = clear gap between.
    gapStripe: { lineW: 2, gapW: 4 },
  },

  // The thin indigo left-edge on actionable Today rows (TaskRow) — a semantic
  // "interactive" marker (colors.primary), not a category color.
  row: { edgeW: 3, edgeH: 20 },

  // Start-By Plan progress rail geometry (RunView). gutter = time/node column
  // width; node = circle diameter; nowRing = pulse halo radius; breatherNode =
  // small breather node diameter; connector = spine line width; dashOn/dashGap =
  // dashed-segment rhythm for completed (done) spine links.
  planRail: { gutter: 46, node: 20, nowRing: 3, breatherNode: 16, connector: 2, nowDot: 7, dashOn: 2, dashGap: 5 },

  motion: {
    fast: 120, base: 220, slow: 360, press: 110, reveal: 600, draw: 950, sheet: 340,
    pulse: 700, toast: 300, honeyFill: 900, float: 3800,
    // stagger = per-item delay in a left→right cascade (honeycomb pip reveal). Keep
    // the whole cascade < ~500ms so it reads lively, not slow (motion-design budget).
    stagger: 40,
    // enterStagger = per-element delay in an onboarding screen's top→bottom reveal
    // cascade (the Reveal wrapper). Slightly looser than `stagger` so a sparse,
    // premium screen breathes rather than snapping in all at once.
    enterStagger: 70,
    // halo = one calm breath of the "you are here" pulse ring on the current
    // mastery-trail node. Slow enough to read as a living glow, never a blink.
    halo: 2200,
    // drift = one full revolution of the RayBurst sunburst. Slow enough to stay
    // calm, fast enough to read as clearly moving (a wedge passes ~every 0.8s).
    drift: 14000,
    // Whenbee-hub ring beats (calm, decelerating). ringFill = entrance/log fill;
    // capFill = the slower ceremonial cap fill; strokePop = the landing thicken;
    // sealSeq = the cap seal-stamp + ripples window; ripple = one outline ripple.
    ringFill: 1600, capFill: 1900, strokePop: 620, sealSeq: 1650, ripple: 720,
    // Whenbee companion micro-life — the bee's calm, premium "alive" loop on the hub.
    // beeWingBuzz = one fold of the calm wing flutter (slow + small — a soft settle,
    // not a buzz); beeBlink = a single eyelid close/open; beeBlinkGap = the long calm
    // rest between blinks; beeLook = one slow eye glance; beeLookHold = the dwell at
    // each glance (longer = calmer). All tuned slow so the bee reads serene, not busy.
    beeWingBuzz: 720, beeBlink: 130, beeBlinkGap: 5200, beeLook: 1400, beeLookHold: 2200,
    // Wax-seal ritual choreography (RitualSeal). Calm, no overshoot: the border
    // draws closed FIRST, then honey wells up, a soft bloom passes, the ✦ fades
    // in, and an amber sparkle bursts radially. Durations + start delays (ms).
    // Honey starts only AFTER the border finishes: border ends at dBorder+border
    // = 40+660 = 700ms, so dHoney = 740 leaves a 40ms beat before honey wells up.
    seal: { border: 660, honey: 580, bloom: 900, mark: 360, spark: 620, dBorder: 40, dHoney: 740, dBloom: 1020, dMark: 1240, dSpark: 1260 },
    // Quick-action arc — the three bubbles that fan from behind the + button.
    // Slow + smooth on the way out (a premium unfurl), a touch quicker tucking
    // back behind the button. Tune both here, not in the component.
    arcIn: 1000, arcOut: 840,
    // Shared physics — deduped from AppButton + FAB.
    spring: { damping: 13, stiffness: 340 },
    // Named curves — declared once, not re-typed per file.
    easing: { standard: Easing.bezier(0.4, 0, 0.2, 1), calm: Easing.inOut(Easing.sin), honey: Easing.bezier(0.22, 1, 0.36, 1), premium: Easing.bezier(0.4, 0, 0.2, 1), out: Easing.bezier(0.23, 1, 0.32, 1) },
  },

  colors: {
    light: {
      // ── 3-step surface ladder (figure/ground: each step lifts clearly) ──
      // bg: '#F4F1EA', // cream (page ground — the 60%)
      // bg: '#F1EEFB', // cream (page ground — the 60%)
      bg: '#F4F2FC', // cream (page ground — the 60%)
      surface: '#FFFFFF', // card — lifts off the cream
      surfaceRaised: '#FFFFFF', // focal card (pair with soft shadow)
      surfaceSunken: '#F1EEFB', // wells / inset tracks
      // surfaceSunken: '#E4DEF7', // wells / inset tracks
      // surfaceSunken: '#ECE8DE', // wells / inset tracks
      hairline: '#DAD5C9', // 1px internal dividers (reads at 3:1 non-text)
      border: '#CFC9BA', // stronger edge for cards that must read
      divider: 'rgba(0,0,0,0.10)', // section separator — a darker recessed line (not a tint)
      shineOverlay: 'rgba(255,255,255,0.55)', // inner top-edge specular (glass lift)

      // ── ink ramp (text) ──
      ink: '#20233A', // primary text (AA on every surface)
      inkSoft: '#5C5F73', // muted text — AA (≥4.5:1) on white + cream
      inkFaint: '#9B9DAB', // ≤3:1, non-essential hairline labels ONLY

      // ── accents (indigo hero / amber true accent) ──
      primary: '#6B5BE6',
      primaryEdge: '#463B9E',
      primarySoft: '#E4E0FA', // low-emphasis indigo fill
      primaryWash: '#EFEDFC', // faintest indigo tint — lighter than primarySoft, still reads off white
      primarySoft2: 'rgba(130,117,240,0.6)',
      primaryChip: 'rgba(107,91,230,0.16)', // CTA indigo at higher opacity than primarySoft (pairs with primary text)
      // Guess-segment diagonal stripe pair — softer than the CTA, clearly two-tone.
      gapStripeHi: '#C8C2F0', // lighter lavender stripe
      gapStripeLo: '#A89EE4', // medium indigo stripe
      // Opaque indigo glyph fill — masks shapes layered behind a line-art body
      // (e.g. BeeGlyph's wings). Must be OPAQUE so the body hides the overlap.
      glyphFill: '#E4E0FA',
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
      dangerEdge: '#A82F2F', // darker depth edge for a filled danger control

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
      ringTrack: '#E4DFD3', // sits just off cream
      // Soft-edge backing coin behind the ring bee (WhenbeeAvatar 'soft'). Pure white
      // (= surface / the card white) — it pops off the lavender bg exactly like the
      // cards do, giving the bee a clean, bright backing. Dark mode steps UP instead.
      companionCoin: '#FFFFFF', // = surface (the card white, reads cleanly on the bg)
      // HUD-row coin: a solid periwinkle medallion (NOT white — white melts into the
      // card here). A step down from primarySoft so the indigo bee body still pops
      // against it. Lifted off the card by companionCoinShadow. Hub ring keeps the
      // softer companionCoin above.
      companionCoinHud: '#C7BCEE',
      companionCoinHudTint: '#5A4BD4', // a darker indigo than primary — soft coin backing
      companionCoinShadow: '#20233A', // = ink; the HUD coin's soft contact-shadow base

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
      divider: 'rgba(0,0,0,0.32)', // section separator — a darker recessed line on the deep bg
      shineOverlay: 'rgba(255,255,255,0.07)', // inner top-edge specular (glass lift)

      // ── ink ramp ──
      ink: '#F4F1EA',
      inkSoft: '#ADA9B5', // solid (off the old 62% alpha) — AA on surface + bg
      inkFaint: 'rgba(244,241,234,0.40)',

      // ── accents ──
      primary: '#8275F0',
      primaryEdge: '#6B5BE6',
      // Ordered to mirror the light set's primary* keys (parity test: light/dark
      // share identical key order). Values are unchanged.
      primarySoft: 'rgba(130,117,240,0.22)',
      primaryWash: 'rgba(130,117,240,0.10)', // faintest indigo tint (dark parity; unused in dark chips)
      primarySoft2: 'rgba(130,117,240,0.6)',
      primaryChip: 'rgba(130,117,240,0.20)', // CTA indigo at higher opacity than primarySoft — a more-filled tinted chip (pairs with primary text)
      // Guess-segment diagonal stripe pair — indigo stripes on near-bg fill.
      gapStripeHi: '#A898F5', // lighter than CTA primary (#8275F0), clearly visible
      gapStripeLo: '#15161F', // = surfaceSunken — blends into bg, only Hi pops
      // Opaque indigo glyph fill — see light-mode note. A touch above the raised
      // card (#292B3C) so the body reads as a gentle fill yet still masks shapes
      // drawn behind it (e.g. BeeGlyph's wings).
      glyphFill: '#3D3F58',
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
      dangerEdge: '#B84A4A', // darker depth edge for a filled danger control

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
      ringTrack: 'rgba(255,255,255,0.08)',
      companionCoin: '#292B3C', // = surfaceRaised (a raised lift on the deep bg)
      // Dark HUD coin stays the soft raised coin (no solid/shadow treatment in dark —
      // it reads fine on the deep card). Mirrors companionCoin so dark is unchanged.
      companionCoinHud: '#292B3C',
      companionCoinHudTint: '#3A3358', // dark coin backing — mirrors companionCoinHud tone
      companionCoinShadow: 'transparent', // unused in dark (shadow doesn't read dark-on-dark)

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

  // Honey ring (Whenbee hub hero). Geometry only — mode-independent like `burst`.
  // size = SVG square edge; stroke = ring weight; popStroke/capStroke = the
  // momentary thickening on a fill-landing / cap; endowedPct = the tiny starting
  // sliver shown at Raw so a fresh ring is never a cold 0.
  // headDot = flat amber dot that rides the arc during the fill animation (px).
  ring: { size: 200, stroke: 9, popStroke: 11, capStroke: 13, endowedPct: 6, headDot: 13 },
  // Wax-seal hex stamped over the bee at the Honest cap (flat-top hexagon WIDTH).
  seal: { size: 38 },
  // Flat motes flicked outward on the cap (solid squares — no glow).
  mote: { size: 5, count: 8, distance: 96 },

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
    // BeeMascot size (px) for the compact Today HUD — smaller than the hub/onboarding
    // bee so the companion reads as a quiet presence beside the honey bar.
    hudBee: 46,
    // Soft-coin backing for the HUD bee. Ringless (no honey ring to frame it), so it
    // needs a HIGH core — a sharp solid disc with only a thin feathered rim — or it
    // reads as a glow at this small size. hudCoinCore = the solid-hold fraction.
    hudCoin: 46,
    hudCoinCore: 0.86,
    // BeeMascot size (px) when it sits INSIDE the HoneyRing on the hub — a touch
    // smaller than the 168 hero so the ring breathes around it and the honey pool
    // (below) reads as a backing halo rather than being crowded to the rim.
    ringBee: 140,
    // Soft-edge backing disc behind the ring bee (the chosen no-glow option) — a
    // neutral raised coin (colors.surfaceRaised) at full tone in the centre that fades
    // to nothing at the rim: lifts the indigo bee off the dark ring interior with no
    // hard edge line and no amber bloom.
    softSize: 170,
    // Flat hard-edged disc (alt option) — solid raised coin + 1px hairline edge.
    discSize: 156,
    discBorder: 1,
    // Soft "honey pool" backdrop disc (the glow option, kept as a fallback) — a radial
    // bloom that lifts the bee without a hard edge. poolSize = disc box edge (px);
    // poolOpacity = centre alpha of the amber bloom (colors.accent), fading to 0 at the
    // rim so it never collides with the ring arc.
    poolSize: 176,
    poolOpacity: 0.16,
  },

  // Pro upsell "pass" card geometry (ProUpsellCard) + paywall Reclaim hero. Kept
  // here so the card inlines no raw px. `stub` = the gilt left-stub width; `edge` =
  // the tactile coin-edge depth (cf. AppButton's filled-pill edge); `notch` = the
  // ticket perforation notch diameter; `emblem` = the honeycomb glyph size in the
  // stub; `comb` = the Reclaim-hero honeycomb motif size.
  upsell: { stub: 88, edge: 6, notch: 14, emblem: 40, comb: 60 },

  // Quick-task chips row (Today screen). All geometry in one place so the row
  // is tunable without touching the component. `disc` = the play-button circle
  // diameter; `chipPadH`/`chipPadV` = chip horizontal/vertical inner padding;
  // `chipGap` = gap between the icon disc and the text block; `rowGap` = gap
  // between chips in the horizontal row.
  // `arc` = the quick-action arc overlay spawned by the tab-bar + button.
  //   bubbleSize   = diameter of each circular bubble (flat disc)
  //   centerSize   = diameter of the center (Timer) bubble — slightly larger, primary-fill
  //   fanRadius    = arc radius: how far each bubble sits from the + button center
  //   verticalOffset = extra upward shift of the arc center above the + button
  //   iconSize     = Ionicons glyph size inside each bubble
  quick: {
    disc: 28, chipPadH: 12, chipPadV: 10, chipGap: 8, rowGap: 8,
    arc: {
      bubbleSize: 52,
      centerSize: 60,
      fanRadius: 92,
      verticalOffset: 16,
      iconSize: 22,
      // Side bubbles fan out ±spreadDeg from 270° (straight up). Wider = taller crown on Timer.
      spreadDeg: 52,
      // leadFrac = how late (as a fraction of the 0→1 open progress) the side
      // bubbles start vs the center (Timer). The center leads the expand and is
      // the last to tuck back behind the + on close — a subtle hero-first cascade.
      leadFrac: 0.12,
      // spinDeg = how far each bubble rotates as it travels out (and back in).
      // Sides mirror each other; reads as a hand of cards fanning open. Large
      // enough (~¾ turn) that the rotation is obvious, not a subtle nudge.
      spinDeg: 300,
    },
  },

  // Patterns ProgressChart geometry — sparkline of accuracy over time. height =
  // SVG box height (pt); stroke = line weight; dot = endpoint radius; areaOpacity
  // = gradient fill alpha under the line; strokeDash = path length used for the
  // draw-on animation (large enough to cover any path).
  chart: { height: 96, stroke: 2.5, dot: 4.5, areaOpacity: 0.32, strokeDash: 1000 },

  // Premium Pro teaser card (ProTeaserCard) — frosted preview panel + amber pill.
  // previewH = preview panel height (pt); barGap = gap between faux bars; barRadius
  // = bar corner; scrimOpacity = the overlay that fakes "frost" over the bars (no
  // native blur dep); barOpacity = the teased bars' own alpha; pillPadX = "Pro"
  // pill horizontal padding.
  proTeaser: { previewH: 118, barGap: 9, barRadius: 4, scrimOpacity: 0.28, barOpacity: 0.55, pillPadX: 11 },

  // ── brand illustration palette ──────────────────────────────────────────────
  // Fixed art colors for the Whenbee mascot (BeeMascot). Brand art does NOT recolor
  // by mode — a mascot reads as the SAME bee in light and dark, the way a logo does.
  // Indigo body ≈ primary, amber stripes ≈ accent family, dark ink ≈ ink, but the
  // exact illustration shades (highlights/shadows/wing cream) live here so they are
  // token-sourced without polluting the semantic UI ramp.
  brand: {
    honeyFill: '#F5C03F', // lit yellow honey — the sealed-cell fill (brighter than accent, distinct from the indigo body)
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

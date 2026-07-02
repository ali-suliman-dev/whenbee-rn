// The widget renders in a separate RemoteViews process where useTheme() is
// unavailable, so its palette is defined here as constants. Values are copied
// from the DARK-mode palette in src/theme/tokens.ts (colors.dark) — update
// both together when the token file changes.
//
// Token-name corrections vs. the original placeholder guesses:
// - There is no literal `colors.honey` key; the amber accent is `colors.accent`.
// - There is no literal `colors.muted`; the muted-ink key is `colors.inkSoft`.
// - `colors.hairline` / `colors.ringTrack` are translucent `rgba(255,255,255,0.08)`
//   strings with NO space after the commas, which does not satisfy this
//   library's `RgbaColor` template type (`rgba(${number}, ${number}, ${number}, ${number})`,
//   space required). RemoteViews also composites translucent colors poorly on
//   some launchers, so the track uses the solid `colors.surfaceSunken` instead —
//   still reads as a recessed well against `surface`.
export const widgetTheme = {
  surface: '#1F2130', // tokens colors.dark.surface
  ink: '#F4F1EA', // tokens colors.dark.ink
  inkMuted: '#ADA9B5', // tokens colors.dark.inkSoft
  accent: '#EEAE4D', // tokens colors.dark.accent (the amber/"honey" accent)
  ringTrack: '#15161F', // tokens colors.dark.surfaceSunken (solid stand-in for the rgba hairline/ringTrack — see note above)
  radius: 20, // = tokens radii.sheet
  padding: 14,
  labelSize: 15,
  captionSize: 12,
  wordmarkSize: 11,
} as const;

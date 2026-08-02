// ──────────────────────────────────────────────────────────────────────────────
// a11yText — strip decorative glyphs out of a VISIBLE string before it is
// spoken by a screen reader.
//
// `ring.sealed` ("Calibrated ✦" / "Kalibrerad ✦") is the one whenbee copy
// string that carries a decorative mark alongside real words. It is correct
// on screen — the ✦ is the same "sealed" visual cue the rest of the app uses
// (see `RitualSeal`, which already keeps a separate `doneA11y` key for exactly
// this reason) — but VoiceOver/TalkBack has no idea "✦" means anything and
// reads it as a stray glyph or silently skips it, either way adding noise to
// an otherwise clean sentence. `useUnlockSentence` stays the single owner of
// the sentence's WORDS (splitting it into a second translation key risks the
// visible and spoken text drifting apart, which is the exact bug class this
// module was written to kill) — this only strips a fixed, known decorative
// character before the string reaches an `accessibilityLabel`.
// ──────────────────────────────────────────────────────────────────────────────

/** Decorative glyphs that appear in whenbee copy but carry no spoken meaning. */
const DECORATIVE_GLYPHS = /\s*✦\s*/g;

/** Strip decorative glyphs from a string bound for `accessibilityLabel`, never
 *  from the string rendered as visible `Text`. */
export function spokenText(visible: string): string {
  return visible.replace(DECORATIVE_GLYPHS, '').trim();
}

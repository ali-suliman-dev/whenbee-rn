// Shared "why" narrative copy for the focus-window card and detail sheet.
// Peak bin → narrative bucket (Tier-1, derived from peak time only).
//
// Returned strings have NO trailing period — callers append the optional
// contrast clause and a single closing period, so the sentence stays
// grammatical whether or not the contrast clause is present.
export function whyNarrative(peakMin: number): string {
  if (peakMin < 660) return 'You start sharp and fade after lunch'; // before 11:00
  if (peakMin < 780) return 'You hit your stride around midday'; // 11:00–13:00
  if (peakMin < 1020) return 'Mornings warm up slow — you peak after lunch'; // 13:00–17:00
  return "You're a slow burn — you peak in the evening"; // after 17:00
}

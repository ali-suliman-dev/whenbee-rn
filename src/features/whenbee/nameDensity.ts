// Name-density guard (doc 12 rule 5): Whenbee names you like a close friend —
// only at meaningful moments (a milestone, a return after a gap), never in routine
// lines or on every surface. Overuse reads as a sales script and erodes the bond.
export function shouldUseName(context: 'greeting' | 'milestone' | 'return' | 'routine'): boolean {
  return context === 'milestone' || context === 'return';
}

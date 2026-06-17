/** Overall hub sharpness = the most-ripened category's sharpness (0 if none). */
export function leadSharpnessOf(cells: { sharpness: number }[]): number {
  return cells.reduce((max, c) => Math.max(max, c.sharpness), 0);
}

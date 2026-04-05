/**
 * Safely coerce a fragility_score value to a finite number.
 * features.json stores fragility_score as JSON strings (Python serialisation quirk),
 * so we must call Number() rather than relying on the TypeScript cast.
 */
export function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/**
 * Find the data row closest to (but not after) a target date where
 * the predicate returns true.
 */
export function findRowForDate<T extends { date: unknown }>(
  rows: T[],
  date: Date,
  predicate: (r: T) => boolean = () => true
): T | null {
  const target = date.getTime();
  let best: T | null = null;
  for (const r of rows) {
    const t = new Date(r.date as string).getTime();
    if (t <= target && predicate(r)) best = r;
  }
  return best;
}

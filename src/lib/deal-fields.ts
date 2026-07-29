// Pure rules behind the Opportunity write actions. Kept out of actions/opportunities.ts so
// they can be tested without a DB — that file is "use server" and every export becomes an
// endpoint.

/** Deal amounts are whole units, never negative. Rejects NaN/Infinity from a blank input. */
export function normalizeValue(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/** 0-100, or null to fall back to the stage's probability. */
export function normalizeProbability(probability: number | null): number | null {
  if (probability === null || !Number.isFinite(probability)) return null;
  return Math.min(100, Math.max(0, Math.round(probability)));
}

/**
 * Only a "lost" stage carries a reason. Moving anywhere else — back to open, or straight from
 * lost to won — clears it, so a stale reason never trails a reopened deal. On a lost move with
 * no new reason given (prompt cancelled), the existing one is kept.
 */
export function resolveLostReason(
  outcome: string | undefined,
  incoming: string | undefined,
  current: string | null
): string | null {
  if (outcome !== "lost") return null;
  return incoming?.trim() || current;
}

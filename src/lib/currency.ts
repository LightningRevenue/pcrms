// Deal amounts are whole units in Opportunity.currency (no minor-unit storage, no FX table).
// Intl does the symbol and grouping; we only pick the currency code.
export const CURRENCIES = ["USD", "EUR", "GBP", "RON", "CHF", "CAD", "AUD"] as const;

export function formatMoney(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Intl throws on a currency code it doesn't know (bad import, hand-edited row).
    return `${currency} ${value.toLocaleString()}`;
  }
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Indian-style compact currency: ₹8.4L, ₹1.2Cr, ₹84,500 */
export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(abs >= 100000000 ? 0 : 2)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${inr.format(Math.round(value))}`;
}

export function formatCurrencyFull(value: number): string {
  return `₹${inr.format(Math.round(value))}`;
}

export function formatNumber(value: number): string {
  return inr.format(Math.round(value));
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Safe previous-period change. Returns null when previous is 0 (display N/A). */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** Safe division for AOV. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

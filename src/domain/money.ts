// One market, one currency (business rules Q9/Q33): prices are VND, whole đồng.

export type Currency = 'VND';
export const CURRENCY: Currency = 'VND';

const vnd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function formatMoney(amount: number | null | undefined, currency: string = CURRENCY): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  if (currency === 'VND') return vnd.format(Math.round(amount));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatPriceRange(min?: number | null, max?: number | null, currency: string = CURRENCY): string {
  if (min == null && max == null) return '—';
  if (min == null || max == null || min === max) return formatMoney(min ?? max, currency);
  return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

/** Sum of price × quantity, rounded to whole đồng. */
export function lineTotal(price: number, quantity: number): number {
  return Math.round(price * quantity);
}

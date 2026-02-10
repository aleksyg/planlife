import type { Debt, YearMonth } from '../types/planState';

// Parse "YYYY-MM" into year/month numbers
function parseYearMonth(ym: YearMonth): { year: number; month: number } {
  const [y, m] = ym.split('-');
  return { year: Number(y), month: Number(m) };
}

// Count whole months between start (inclusive) and end (inclusive-ish).
// Example: start 2026-02, payoff 2027-02 => 12 months
export function monthsUntilPayoff(start: YearMonth, payoff: YearMonth): number {
  const a = parseYearMonth(start);
  const b = parseYearMonth(payoff);
  const months = (b.year - a.year) * 12 + (b.month - a.month);
  return Math.max(0, months);
}

/**
 * Suggested monthly payment for amortizing loan to payoffYearMonth.
 * Uses standard loan payment formula:
 *   P = r*PV / (1 - (1+r)^-n)
 * where r is monthly rate, n is number of months.
 *
 * Notes:
 * - If APR is 0, payment is PV / n.
 * - If payoff is this month or earlier, return full balance (or 0 if balance 0).
 */
export function computeSuggestedDebtMonthlyPayment(
  debt: Pick<Debt, 'balance' | 'aprPct' | 'payoffYearMonth'>,
  projectionStart: YearMonth,
): number {
  const balance = Math.max(0, debt.balance);
  if (balance === 0) return 0;

  const n = monthsUntilPayoff(projectionStart, debt.payoffYearMonth);
  if (n <= 0) return balance;

  const apr = Math.max(0, debt.aprPct);
  const r = apr / 100 / 12;

  if (r === 0) return balance / n;

  const denom = 1 - Math.pow(1 + r, -n);
  if (denom <= 0) return balance; // safety fallback

  return (r * balance) / denom;
}

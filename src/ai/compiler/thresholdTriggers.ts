export type ThresholdSeriesKey = "brokerageByYear" | "netWorthByYear" | "grossIncomeByYear";

export type ThresholdTrigger = {
  seriesKey: ThresholdSeriesKey;
  threshold: number;
};

function parseDollarAmount(raw: string): number | null {
  // Supports: $15000, 15,000, 15k, 1.5m
  const cleaned = raw.replace(/[, ]/g, "").trim().toLowerCase();
  const m = cleaned.match(/^\$?(\d+(\.\d+)?)(k|m)?$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = m[3];
  const mult = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1;
  return base * mult;
}

export function inferThresholdTriggerFromText(text: string): ThresholdTrigger | null {
  const t = text.toLowerCase();

  const isNetWorth = /\bnet\s*worth\b/.test(t);
  const isInvestments = /\b(investments?|portfolio|brokerage)\b/.test(t);
  const isIncome = /\b(income|gross)\b/.test(t);

  // e.g. "once I have $1m saved", "once investments hit 1.5m", "when net worth reaches $2,000,000"
  const m =
    t.match(/\b(?:once|when)\b[\s\S]{0,80}?\b(?:hit|hits|reach|reaches|exceed|exceeds|over|above|>=)\b[\s\S]{0,20}?(\$?[\d.,]+(?:\.\d+)?\s*[km]?)/) ??
    t.match(/\b(?:once|when)\b[\s\S]{0,80}?(\$?[\d.,]+(?:\.\d+)?\s*[km]?)\b/);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  const threshold = parseDollarAmount(raw);
  if (!threshold || threshold <= 0) return null;

  const seriesKey: ThresholdSeriesKey = isNetWorth
    ? "netWorthByYear"
    : isInvestments
      ? "brokerageByYear"
      : isIncome
        ? "grossIncomeByYear"
        : "brokerageByYear";

  return { seriesKey, threshold };
}

export function firstYearIndexMeetingThreshold(series: readonly number[], threshold: number): number | null {
  const idx = series.findIndex((x) => x >= threshold);
  return idx >= 0 ? idx : null;
}


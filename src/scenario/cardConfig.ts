/**
 * Stable configs for scenario cards. Each config is sufficient to regenerate
 * overrides deterministically via buildOverridesFromCardConfig.
 */

export type IncomeConfig = {
  type: "income";
  startAge: number;
  baseAnnual: number;
  bonusAnnual: number;
  growthRate?: number;
  /** Observed monthly take-home from base pay only. Used for cashflow; taxes still from gross. */
  observedBaseNetPayMonthly?: number;
};

export type ScenarioCardConfig = IncomeConfig; // | HomeConfig | ExpenseConfig | ...

export function isIncomeConfig(cfg: unknown): cfg is IncomeConfig {
  if (typeof cfg !== "object" || cfg === null) return false;
  const o = cfg as Record<string, unknown>;
  return (
    o.type === "income" &&
    typeof o.startAge === "number" &&
    typeof o.baseAnnual === "number" &&
    typeof o.bonusAnnual === "number"
  );
}

export function parseScenarioCardConfig(raw: unknown): ScenarioCardConfig | null {
  if (!isRecord(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "income" && isIncomeConfig(o)) return o;
  return null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

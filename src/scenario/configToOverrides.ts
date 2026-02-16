import type { PlanState } from "@/engine";
import type { TargetedOverride } from "@/rulespec/types";
import type { IncomeConfig, ScenarioCardConfig } from "./cardConfig";

/**
 * Build TargetedOverride[] from a ScenarioCardConfig using existing override plumbing.
 * Deterministic: same config + plan bounds => same override set in the same order.
 * No dependence on other cards or implicit state.
 *
 * Invariant: Growth overrides replace baseline growth for affected years; they do not add to it.
 * (Enforced by rulespec buildSeries: growthOverrides overwrite spec.growth.annualPct per index.)
 *
 * Invariant: startAge means "applies starting in the year where age === startAge and continues onward."
 * We emit a single "set" at startAge; the engine compounds from that anchor so values persist forward.
 */
export function buildOverridesFromCardConfig(
  plan: PlanState,
  config: ScenarioCardConfig,
): TargetedOverride[] {
  if (config.type === "income") return buildOverridesFromIncomeConfig(plan, config);
  return [];
}

function buildOverridesFromIncomeConfig(plan: PlanState, cfg: IncomeConfig): TargetedOverride[] {
  const overrides: TargetedOverride[] = [];
  const startAge = Math.max(cfg.startAge, plan.startAge);

  // Base: set at startAge (engine compounds forward; applies from startAge onward)
  overrides.push({
    target: "income.user.base",
    kind: "set",
    fromAge: startAge,
    toAge: undefined,
    value: Math.max(0, cfg.baseAnnual),
  });

  // Bonus: always emit so that setting bonus to 0 does not re-expose baseline bonus
  const bonus = Math.max(0, cfg.bonusAnnual ?? 0);
  overrides.push({
    target: "income.user.bonus",
    kind: "set",
    fromAge: startAge,
    toAge: undefined,
    value: bonus,
  });

  // Growth: when specified (including 0), replace baseline growth from startAge onward
  const growthRate = cfg.growthRate;
  if (growthRate !== undefined && Number.isFinite(growthRate)) {
    overrides.push({
      target: "income.user.base.growthPct",
      kind: "set",
      fromAge: startAge,
      toAge: undefined,
      value: growthRate,
    });
    overrides.push({
      target: "income.user.bonus.growthPct",
      kind: "set",
      fromAge: startAge,
      toAge: undefined,
      value: growthRate,
    });
  }

  // Observed net: emit even when 0 (zero is explicit). Affects cashflow only, not taxes.
  if (cfg.observedBaseNetPayMonthly !== undefined && Number.isFinite(cfg.observedBaseNetPayMonthly)) {
    overrides.push({
      target: "income.user.observedBaseNetPayMonthly",
      kind: "set",
      fromAge: startAge,
      toAge: undefined,
      value: Math.max(0, cfg.observedBaseNetPayMonthly),
    });
  }

  return overrides;
}

import type { PlanState, YearInputs } from "@/engine";
import { deriveRuleSpecInputsFromPlanState } from "./deriveFromPlanState";
import { applyOverridesToRuleSpecInputs } from "./applyOverrides";
import { materializeYearInputs } from "./materializeYearInputs";
import type { TargetedOverride } from "./types";

export type { Timeline, GrowthRule, Override, GrowthOverride, TargetedOverride, TargetKey, ComponentSpec, RuleSpecInputs } from "./types";
export { makeTimeline, yearIndexFromAge } from "./timeline";
export { buildSeries } from "./buildSeries";
export { deriveRuleSpecInputsFromPlanState } from "./deriveFromPlanState";
export { applyOverridesToRuleSpecInputs } from "./applyOverrides";
export { materializeYearInputs } from "./materializeYearInputs";

export function buildScenarioYearInputsFromOverrides(plan: PlanState, ops: readonly TargetedOverride[]): YearInputs[] {
  const base = deriveRuleSpecInputsFromPlanState(plan);
  const next = applyOverridesToRuleSpecInputs(base, ops);
  return materializeYearInputs(plan, next);
}


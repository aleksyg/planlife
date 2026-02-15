import type { PlanState, YearInputs } from "@/engine";
import { buildScenarioYearInputsFromOverrides } from "@/rulespec";
import type { TargetedOverride } from "@/rulespec/types";

/**
 * A saved scenario modifier card. Applied in createdAt order; later cards override earlier
 * when modifying the same field and year.
 */
export type ScenarioCard = {
  id: string;
  createdAt: number;
  title: string;
  summary: string;
  enabled: boolean;
  overrides: TargetedOverride[];
};

/**
 * Single source of truth: scenario = baseline + enabled modifiers (and optional draft last).
 * Baseline is never mutated. Deterministic: enabled cards applied in creation order; draft (if any) applied last.
 *
 * When there are no active modifiers (no enabled cards and no draft), returns [] so the caller
 * uses baseline simulation directly. Scenario must never be left empty: caller uses baseline when [].
 */
export function getScenarioYearInputs(
  plan: PlanState,
  cards: readonly ScenarioCard[],
  draftOverrides: readonly TargetedOverride[] | null,
): YearInputs[] {
  const enabled = [...cards].filter((c) => c.enabled).sort((a, b) => a.createdAt - b.createdAt);
  const overrides: TargetedOverride[] = enabled.flatMap((c) => c.overrides);
  if (draftOverrides?.length) overrides.push(...draftOverrides);
  if (overrides.length === 0) return [];
  return buildScenarioYearInputsFromOverrides(plan, overrides);
}

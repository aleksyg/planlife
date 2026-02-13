import type { PlanState } from "@/engine";
import type { ComponentSpec, RuleSpecInputs } from "./types";
import { makeTimeline } from "./timeline";

function getLifestyleMonthly(plan: PlanState): number {
  if (plan.expenses.mode === "total") return plan.expenses.lifestyleMonthly;
  return plan.expenses.items.reduce((s, x) => s + x.monthlyAmount, 0);
}

function getHousingMonthly(plan: PlanState): number {
  return plan.household.housing.status === "rent"
    ? plan.household.housing.monthlyRent
    : plan.household.housing.monthlyPaymentPITI;
}

function mkComponentSpec(args: { startValue: number; growthPct: number }): ComponentSpec {
  return {
    startValue: args.startValue,
    growth: { type: "pct", annualPct: args.growthPct },
    overrides: [],
  };
}

/**
 * Derive rule-based baseline inputs from current `PlanState`.
 *
 * Baseline parity requirement:
 * - Income base+bonus use the same compounding rate as the engine (`incomeGrowthRate`).
 * - Spending is constant (growth=0) unless overridden (matches current engine behavior).
 */
export function deriveRuleSpecInputsFromPlanState(plan: PlanState): RuleSpecInputs {
  const timeline = makeTimeline(plan.startAge, plan.endAge);
  const partnerEnabled = Boolean(plan.household.hasPartner && plan.household.partner);

  const userIncome = plan.household.user.income;
  const userBase = mkComponentSpec({ startValue: userIncome.baseAnnual, growthPct: userIncome.incomeGrowthRate });
  const userBonus = mkComponentSpec({
    startValue: userIncome.hasBonus ? (userIncome.bonusAnnual ?? 0) : 0,
    growthPct: userIncome.incomeGrowthRate,
  });

  const partner =
    partnerEnabled && plan.household.partner
      ? (() => {
          const pIncome = plan.household.partner!.income;
          return {
            base: mkComponentSpec({ startValue: pIncome.baseAnnual, growthPct: pIncome.incomeGrowthRate }),
            bonus: mkComponentSpec({
              startValue: pIncome.hasBonus ? (pIncome.bonusAnnual ?? 0) : 0,
              growthPct: pIncome.incomeGrowthRate,
            }),
          };
        })()
      : undefined;

  const spendLifestyle = mkComponentSpec({ startValue: getLifestyleMonthly(plan), growthPct: 0 });
  const spendHousing = mkComponentSpec({ startValue: getHousingMonthly(plan), growthPct: 0 });

  return {
    timeline,
    partnerEnabled,
    income: {
      user: { base: userBase, bonus: userBonus },
      partner,
    },
    spend: { lifestyleMonthly: spendLifestyle, housingMonthly: spendHousing },
  };
}


import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import type { AiAction } from "./types";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(pct: number): string {
  return `${pct.toFixed(0)}%`;
}

function formatRate(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

function describeAction(action: AiAction, baseline: PlanState): string {
  switch (action.type) {
    case "QuitPartnerJobFromYearIndex": {
      const base = baseline.household.partner?.income.baseAnnual ?? 0;
      const age = baseline.startAge + action.yearIndex;
      return `Partner stops working starting Year ${action.yearIndex} (age ${age}); partner income is treated as $0 from then onward. Current partner base salary is ${formatCurrency(base)}/yr.`;
    }
    case "SetUserBaseAnnual": {
      const from = baseline.household.user.income.baseAnnual;
      return `Update your base salary from ${formatCurrency(from)}/yr to ${formatCurrency(action.value)}/yr.`;
    }
    case "SetPartnerBaseAnnual": {
      const from = baseline.household.partner?.income.baseAnnual ?? 0;
      return `Update partner base salary from ${formatCurrency(from)}/yr to ${formatCurrency(action.value)}/yr.`;
    }
    case "SetIncomeGrowthRate": {
      const from =
        action.who === "user"
          ? baseline.household.user.income.incomeGrowthRate
          : baseline.household.partner?.income.incomeGrowthRate ?? 0;
      return `Update ${action.who} income growth rate from ${formatRate(from)} to ${formatRate(action.value)}.`;
    }
    case "SetLifestyleMonthly": {
      const from =
        baseline.expenses.mode === "total"
          ? baseline.expenses.lifestyleMonthly
          : baseline.expenses.items.reduce((s, x) => s + x.monthlyAmount, 0);
      return `Update lifestyle spending from ${formatCurrency(from)}/mo to ${formatCurrency(action.value)}/mo.`;
    }
    case "SetHousingMonthlyRent": {
      const from =
        baseline.household.housing.status === "rent"
          ? baseline.household.housing.monthlyRent
          : baseline.household.housing.monthlyPaymentPITI;
      return `Update housing cost from ${formatCurrency(from)}/mo to ${formatCurrency(action.value)}/mo (modeled as rent).`;
    }
    case "SetHousingMonthlyRentFromYearIndex": {
      const from =
        baseline.household.housing.status === "rent"
          ? baseline.household.housing.monthlyRent
          : baseline.household.housing.monthlyPaymentPITI;
      const age = baseline.startAge + action.yearIndex;
      return `Update housing cost from ${formatCurrency(from)}/mo to ${formatCurrency(action.value)}/mo starting Year ${
        action.yearIndex
      } (age ${age}), and keep it there for the rest of the projection (modeled as rent).`;
    }
    case "SetStateTaxRate": {
      const from = baseline.assumptions.stateTaxRate ?? 0;
      return `Update state tax rate from ${from} (${formatRate(from)}) to ${action.value} (${formatRate(action.value)}).`;
    }
    case "SetRetirementSplitPct": {
      const ret =
        action.who === "user"
          ? baseline.household.user.income.retirement
          : baseline.household.partner?.income.retirement;
      const fromPre = ret?.employeePreTaxContributionPct ?? 0;
      const fromRoth = ret?.employeeRothContributionPct ?? 0;
      return `Update ${action.who} retirement split from ${formatPct(fromPre)} pre-tax + ${formatPct(
        fromRoth,
      )} Roth to ${formatPct(action.preTaxPct)} pre-tax + ${formatPct(action.rothPct)} Roth.`;
    }
    case "SetEmployerMatch": {
      const ret =
        action.who === "user"
          ? baseline.household.user.income.retirement
          : baseline.household.partner?.income.retirement;
      const has = ret?.hasEmployerMatch ?? false;
      const matchPct = ret?.employerMatchPct ?? 0;
      const upTo = ret?.employerMatchUpToPct ?? 0;
      if (!action.hasMatch) {
        return `Turn off ${action.who} employer match (currently ${
          has ? `${formatPct(matchPct)} match up to ${formatPct(upTo)}` : "off"
        }).`;
      }
      return `Set ${action.who} employer match to ${formatPct(action.matchPct ?? 0)} match up to ${formatPct(
        action.upToPct ?? 0,
      )} (currently ${has ? `${formatPct(matchPct)} up to ${formatPct(upTo)}` : "off"}).`;
    }
    case "SetPreTaxDeductionsMonthly": {
      const from =
        action.who === "user"
          ? baseline.household.user.income.preTaxDeductionsMonthly ?? 0
          : baseline.household.partner?.income.preTaxDeductionsMonthly ?? 0;
      return `Update ${action.who} pre-tax deductions from ${formatCurrency(from)}/mo to ${formatCurrency(
        action.value,
      )}/mo.`;
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export type AiProposalExplanation = {
  changes: string[];
  implications: string[];
};

export function explainAiProposal(args: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  scenarioRows: readonly YearRow[];
  actions: AiAction[];
}): AiProposalExplanation {
  const { baselinePlan, baselineRows, scenarioRows, actions } = args;

  const changes = actions.map((a) => describeAction(a, baselinePlan));

  const lastBase = baselineRows[baselineRows.length - 1];
  const lastScen = scenarioRows[scenarioRows.length - 1];

  const focusAction =
    actions.find((a) => a.type === "QuitPartnerJobFromYearIndex") ??
    actions.find((a) => a.type === "SetHousingMonthlyRentFromYearIndex");
  const focusYearIndex =
    focusAction?.type === "QuitPartnerJobFromYearIndex" || focusAction?.type === "SetHousingMonthlyRentFromYearIndex"
      ? focusAction.yearIndex
      : 0;
  const focusBase = baselineRows[focusYearIndex];
  const focusScen = scenarioRows[focusYearIndex];

  const implications: string[] = [];

  if (focusBase && focusScen) {
    implications.push(
      `Year ${focusYearIndex} (age ${focusBase.age}) household gross income changes from ${formatCurrency(
        focusBase.grossIncome,
      )} to ${formatCurrency(focusScen.grossIncome)} (${formatCurrency(focusScen.grossIncome - focusBase.grossIncome)}).`,
    );
  }

  const y0b = baselineRows[0];
  const y0s = scenarioRows[0];
  if (y0b && y0s) {
    implications.push(
      `Year 0 taxes change from ${formatCurrency(y0b.taxesPaid)} to ${formatCurrency(y0s.taxesPaid)} (${formatCurrency(
        y0s.taxesPaid - y0b.taxesPaid,
      )}).`,
    );
  }

  if (lastBase && lastScen) {
    implications.push(
      `By age ${lastBase.age}, net worth changes by ${formatCurrency(lastScen.endNetWorth - lastBase.endNetWorth)} (from ${formatCurrency(
        lastBase.endNetWorth,
      )} to ${formatCurrency(lastScen.endNetWorth)}).`,
    );
  }

  return { changes, implications };
}


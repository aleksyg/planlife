import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";

export type AiAllowedMutations = {
  // Bounds/constraints for validation
  yearIndex: { min: number; max: number };
  dollars: { min: number; max: number };
  monthlyDollars: { min: number; max: number };
  rate: { min: number; max: number }; // 0..1 (e.g. stateTaxRate)
  pct: { min: number; max: number }; // 0..100
  growthRate: { min: number; max: number }; // 0..0.2
};

export type AiCurrentValues = {
  hasPartner: boolean;
  startAge: number;
  endAge: number;

  user: {
    baseAnnual: number;
    incomeGrowthRate: number;
    preTaxDeductionsMonthly: number;
    retirement: {
      hasPlan: boolean;
      preTaxPct: number;
      rothPct: number;
      hasEmployerMatch: boolean;
      employerMatchPct: number;
      employerMatchUpToPct: number;
    };
  };

  partner?: {
    baseAnnual: number;
    incomeGrowthRate: number;
    preTaxDeductionsMonthly: number;
    retirement: {
      hasPlan: boolean;
      preTaxPct: number;
      rothPct: number;
      hasEmployerMatch: boolean;
      employerMatchPct: number;
      employerMatchUpToPct: number;
    };
  };

  lifestyleMonthly: number;
  housingMonthlyRent: number;

  stateTaxRate: number;
};

export type AiBaselineSummary = {
  keyMetrics: {
    finalAge: number;
    finalNetWorth: number;
    finalAssets: number;
    finalDebt: number;
    year0TaxesTotal: number;
    year0TaxesFederal: number;
    year0TaxesState: number;
    year0TaxesFica: number;
  };
  whyNotes: string[];
};

export type AiPromptPayload = {
  allowedMutations: AiAllowedMutations;
  currentValues: AiCurrentValues;
  baselineSummary: AiBaselineSummary;
};

function getLifestyleMonthly(plan: PlanState): number {
  if (plan.expenses.mode === "total") return plan.expenses.lifestyleMonthly;
  return plan.expenses.items.reduce((s, x) => s + x.monthlyAmount, 0);
}

function getHousingMonthlyRent(plan: PlanState): number {
  if (plan.household.housing.status === "rent") return plan.household.housing.monthlyRent;
  return plan.household.housing.monthlyPaymentPITI;
}

export function buildAiPromptPayload(plan: PlanState, baselineRows: YearRow[]): AiPromptPayload {
  const years = Math.max(1, plan.endAge - plan.startAge + 1);
  const last = baselineRows[baselineRows.length - 1];
  const y0 = baselineRows[0];

  const currentValues: AiCurrentValues = {
    hasPartner: plan.household.hasPartner,
    startAge: plan.startAge,
    endAge: plan.endAge,
    user: {
      baseAnnual: plan.household.user.income.baseAnnual,
      incomeGrowthRate: plan.household.user.income.incomeGrowthRate,
      preTaxDeductionsMonthly: plan.household.user.income.preTaxDeductionsMonthly ?? 0,
      retirement: {
        hasPlan: plan.household.user.income.retirement?.hasPlan ?? false,
        preTaxPct: plan.household.user.income.retirement?.employeePreTaxContributionPct ?? 0,
        rothPct: plan.household.user.income.retirement?.employeeRothContributionPct ?? 0,
        hasEmployerMatch: plan.household.user.income.retirement?.hasEmployerMatch ?? false,
        employerMatchPct: plan.household.user.income.retirement?.employerMatchPct ?? 0,
        employerMatchUpToPct: plan.household.user.income.retirement?.employerMatchUpToPct ?? 0,
      },
    },
    partner: plan.household.hasPartner && plan.household.partner
      ? {
          baseAnnual: plan.household.partner.income.baseAnnual,
          incomeGrowthRate: plan.household.partner.income.incomeGrowthRate,
          preTaxDeductionsMonthly: plan.household.partner.income.preTaxDeductionsMonthly ?? 0,
          retirement: {
            hasPlan: plan.household.partner.income.retirement?.hasPlan ?? false,
            preTaxPct: plan.household.partner.income.retirement?.employeePreTaxContributionPct ?? 0,
            rothPct: plan.household.partner.income.retirement?.employeeRothContributionPct ?? 0,
            hasEmployerMatch: plan.household.partner.income.retirement?.hasEmployerMatch ?? false,
            employerMatchPct: plan.household.partner.income.retirement?.employerMatchPct ?? 0,
            employerMatchUpToPct: plan.household.partner.income.retirement?.employerMatchUpToPct ?? 0,
          },
        }
      : undefined,
    lifestyleMonthly: getLifestyleMonthly(plan),
    housingMonthlyRent: getHousingMonthlyRent(plan),
    stateTaxRate: plan.assumptions.stateTaxRate ?? 0,
  };

  const allowedMutations: AiAllowedMutations = {
    yearIndex: { min: 0, max: years - 1 },
    dollars: { min: 0, max: 10_000_000 },
    monthlyDollars: { min: 0, max: 200_000 },
    rate: { min: 0, max: 0.2 },
    pct: { min: 0, max: 100 },
    growthRate: { min: 0, max: 0.2 },
  };

  const baselineSummary: AiBaselineSummary = {
    keyMetrics: {
      finalAge: last?.age ?? plan.endAge,
      finalNetWorth: last?.endNetWorth ?? 0,
      finalAssets: last?.endAssetValue ?? 0,
      finalDebt: last?.totalDebtBalance ?? 0,
      year0TaxesTotal: y0?.taxesPaid ?? 0,
      year0TaxesFederal: y0?.federalIncomeTax ?? 0,
      year0TaxesState: y0?.stateIncomeTax ?? 0,
      year0TaxesFica: y0?.payrollTax ?? 0,
    },
    whyNotes: [
      "Savings are allocated to cash until 6× total monthly outflow, then overflow goes to brokerage.",
      "Taxes include federal (2026 brackets + standard deduction), state flat %, and employee FICA (SS cap, Medicare, Additional Medicare).",
      "Employer match is based on employee total contribution % (pre-tax + Roth), capped by the match up-to percent of pay.",
    ],
  };

  return { allowedMutations, currentValues, baselineSummary };
}


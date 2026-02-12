"use client";

import * as React from "react";
import type { PlanState } from "@/engine";
import type { YearMonth } from "@/engine/types/planState";

const STORAGE_KEY = "planlife-baseline";

function toYearMonth(year: number, month: number): YearMonth {
  const m = String(month).padStart(2, "0");
  return `${year}-${m}` as YearMonth;
}

/** Default as-of date for new plans */
function defaultAsOf(): YearMonth {
  const d = new Date();
  return toYearMonth(d.getFullYear(), d.getMonth() + 1);
}

/** Build a full PlanState from minimal form values. Used by UI only; engine stays pure. */
export function buildPlanStateFromForm(form: BaselineFormState): PlanState {
  const asOf = form.asOfYearMonth || defaultAsOf();
  const startAge = form.startAge ?? 30;
  const endAge = form.endAge ?? 65;

  const userIncome = {
    baseAnnual: form.userBaseAnnual ?? 0,
    hasBonus: false,
    incomeGrowthRate: form.incomeGrowthRate ?? 0.03,
    preTaxDeductionsMonthly: form.userPreTaxDeductionsMonthly ?? 0,
    retirement: {
      hasPlan: form.userHasRetirement ?? false,
      employeePreTaxContributionPct: form.userRetirementPreTaxPct ?? 0,
      employeeRothContributionPct: form.userRetirementRothPct ?? 0,
      hasEmployerMatch: false,
    },
  };

  const partnerIncome = {
    baseAnnual: form.partnerBaseAnnual ?? 0,
    hasBonus: false,
    incomeGrowthRate: form.incomeGrowthRate ?? 0.03,
    preTaxDeductionsMonthly: form.partnerPreTaxDeductionsMonthly ?? 0,
    retirement: {
      hasPlan: form.partnerHasRetirement ?? false,
      employeePreTaxContributionPct: form.partnerRetirementPreTaxPct ?? 0,
      employeeRothContributionPct: form.partnerRetirementRothPct ?? 0,
      hasEmployerMatch: false,
    },
  };

  const debt = [
    {
      id: "debt-1",
      label: "Debt",
      type: "other" as const,
      balance: form.debtBalance ?? 0,
      aprPct: form.debtAprPct ?? 0,
      payoffYearMonth: form.debtPayoffYearMonth ?? (toYearMonth(new Date().getFullYear() + 2, 6) as YearMonth),
      monthlyPayment: form.debtMonthlyPayment ?? 0,
      monthlyPaymentIsOverride: true,
    },
  ];

  const cashBalance = form.assetsCash ?? 0;
  const investBalance = form.assetsInvestments ?? 0;

  return {
    asOfYearMonth: asOf,
    startAge,
    endAge,
    household: {
      user: {
        age: startAge,
        income: userIncome,
      },
      hasPartner: form.hasPartner ?? false,
      partner:
        form.hasPartner && form.partnerBaseAnnual != null
          ? {
              age: startAge,
              income: partnerIncome,
            }
          : undefined,
      tax: {
        filingStatus: form.filingStatus ?? (form.hasPartner ? "marriedJoint" : "single"),
      },
      hasChildren: false,
      housing: {
        status: "rent" as const,
        monthlyRent: form.housingMonthly ?? 0,
      },
    },
    expenses: {
      mode: "total",
      lifestyleMonthly: form.lifestyleMonthly ?? 0,
    },
    debt,
    balanceSheet: {
      assets: [
        ...(cashBalance > 0 ? [{ id: "cash-1", label: "Cash", type: "cash" as const, owner: "joint" as const, balance: cashBalance }] : []),
        ...(investBalance > 0 ? [{ id: "inv-1", label: "Investments", type: "brokerage" as const, owner: "joint" as const, balance: investBalance }] : []),
      ].filter(Boolean) as PlanState["balanceSheet"]["assets"],
      home: { owner: "joint", currentValue: form.homeValue ?? 0 },
    },
    assumptions: {
      inflationRate: form.inflationRate ?? 0.025,
      returnRate: form.returnRate ?? 0.07,
      cashRate: form.cashRate ?? 0.04,
      flatTaxRate: form.flatTaxRate ?? 0.3,
      stateTaxRate: form.stateTaxRate ?? 0,
    },
  };
}

/** Form state for baseline inputs (UI only). */
export type BaselineFormState = {
  asOfYearMonth?: YearMonth;
  startAge?: number;
  endAge?: number;
  userBaseAnnual?: number;
  incomeGrowthRate?: number;
  userHasRetirement?: boolean;
  userRetirementPreTaxPct?: number;
  userRetirementRothPct?: number;
  userPreTaxDeductionsMonthly?: number;
  hasPartner?: boolean;
  partnerBaseAnnual?: number;
  partnerHasRetirement?: boolean;
  partnerRetirementPreTaxPct?: number;
  partnerRetirementRothPct?: number;
  partnerPreTaxDeductionsMonthly?: number;
  filingStatus?: "single" | "marriedJoint";
  lifestyleMonthly?: number;
  housingMonthly?: number;
  debtBalance?: number;
  debtAprPct?: number;
  debtMonthlyPayment?: number;
  debtPayoffYearMonth?: YearMonth;
  assetsCash?: number;
  assetsInvestments?: number;
  homeValue?: number;
  inflationRate?: number;
  returnRate?: number;
  cashRate?: number;
  flatTaxRate?: number;
  stateTaxRate?: number;
};

/** Parse and validate number from string; returns undefined if invalid. */
export function parseNum(s: string | undefined): number | undefined {
  if (s === undefined || s === "") return undefined;
  const n = Number(s);
  if (Number.isNaN(n)) return undefined;
  return n;
}

/** Validate required numbers for baseline. Returns error message or null. */
export function validateBaselineForm(form: BaselineFormState): string | null {
  if (form.startAge == null || form.startAge < 18 || form.startAge > 100)
    return "Start age must be between 18 and 100.";
  if (form.endAge == null || form.endAge < form.startAge!)
    return "End age must be >= start age.";
  if (form.userBaseAnnual == null || form.userBaseAnnual < 0)
    return "User income is required and must be >= 0.";
  if (form.lifestyleMonthly == null || form.lifestyleMonthly < 0)
    return "Lifestyle (monthly) is required and must be >= 0.";
  if (form.housingMonthly == null || form.housingMonthly < 0)
    return "Housing (monthly) is required and must be >= 0.";
  if (form.debtBalance == null || form.debtBalance < 0)
    return "Debt balance must be >= 0.";
  if (form.debtAprPct == null || form.debtAprPct < 0)
    return "Debt APR must be >= 0.";
  if (form.debtMonthlyPayment == null || form.debtMonthlyPayment < 0)
    return "Debt monthly payment must be >= 0.";
  if (form.hasPartner && (form.partnerBaseAnnual == null || form.partnerBaseAnnual < 0))
    return "Partner income must be >= 0 when partner is enabled.";
  if (form.hasPartner && form.filingStatus === "single")
    return "Filing status must be Married Filing Jointly when partner is enabled (v1).";
  if ((form.userPreTaxDeductionsMonthly ?? 0) < 0) return "User pre-tax deductions must be >= 0.";
  if (form.hasPartner && (form.partnerPreTaxDeductionsMonthly ?? 0) < 0)
    return "Partner pre-tax deductions must be >= 0.";
  if (form.userHasRetirement) {
    const pre = form.userRetirementPreTaxPct ?? 0;
    const roth = form.userRetirementRothPct ?? 0;
    if (pre < 0 || roth < 0) return "User retirement contribution % must be >= 0.";
    if (pre + roth > 100) return "User retirement pre-tax % + Roth % must be <= 100.";
  }
  if (form.hasPartner && form.partnerHasRetirement) {
    const pre = form.partnerRetirementPreTaxPct ?? 0;
    const roth = form.partnerRetirementRothPct ?? 0;
    if (pre < 0 || roth < 0) return "Partner retirement contribution % must be >= 0.";
    if (pre + roth > 100) return "Partner retirement pre-tax % + Roth % must be <= 100.";
  }
  const cash = form.assetsCash ?? 0;
  const inv = form.assetsInvestments ?? 0;
  if (cash < 0 || inv < 0) return "Asset balances must be >= 0.";
  return null;
}

export function loadBaselineFromStorage(): PlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;

    // Lightweight migration for older saved plans.
    parsed.assumptions = parsed.assumptions ?? {};
    if (parsed.assumptions.flatTaxRate == null) parsed.assumptions.flatTaxRate = 0.3;
    if (parsed.assumptions.stateTaxRate == null) parsed.assumptions.stateTaxRate = 0;

    const userRet = parsed.household?.user?.income?.retirement;
    if (userRet) {
      // If an old single % exists, treat it as pre-tax.
      if (userRet.employeePreTaxContributionPct == null && userRet.employeeContributionPct != null) {
        userRet.employeePreTaxContributionPct = userRet.employeeContributionPct;
      }
      if (userRet.employeeRothContributionPct == null) userRet.employeeRothContributionPct = 0;
      delete userRet.employeeContributionPct;
    }

    const partnerRet = parsed.household?.partner?.income?.retirement;
    if (partnerRet) {
      if (
        partnerRet.employeePreTaxContributionPct == null &&
        partnerRet.employeeContributionPct != null
      ) {
        partnerRet.employeePreTaxContributionPct = partnerRet.employeeContributionPct;
      }
      if (partnerRet.employeeRothContributionPct == null) partnerRet.employeeRothContributionPct = 0;
      delete partnerRet.employeeContributionPct;
    }

    // Defaults/migration for new tax + deductions fields.
    if (parsed.household?.tax?.filingStatus == null) {
      parsed.household = parsed.household ?? {};
      parsed.household.tax = {
        filingStatus: parsed.household.hasPartner ? "marriedJoint" : "single",
      };
    }
    if (parsed.household?.user?.income && parsed.household.user.income.preTaxDeductionsMonthly == null) {
      parsed.household.user.income.preTaxDeductionsMonthly = 0;
    }
    if (parsed.household?.partner?.income && parsed.household.partner.income.preTaxDeductionsMonthly == null) {
      parsed.household.partner.income.preTaxDeductionsMonthly = 0;
    }

    return parsed as PlanState;
  } catch {
    return null;
  }
}

export function saveBaselineToStorage(plan: PlanState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // ignore
  }
}

export type SetBaselineFormState = React.Dispatch<React.SetStateAction<BaselineFormState>>;

/** Default form state for initial load */
export function getDefaultFormState(): BaselineFormState {
  return {
    startAge: 30,
    endAge: 65,
    userBaseAnnual: 100_000,
    incomeGrowthRate: 0.03,
    userHasRetirement: true,
    userRetirementPreTaxPct: 10,
    userRetirementRothPct: 0,
    userPreTaxDeductionsMonthly: 0,
    hasPartner: false,
    partnerBaseAnnual: 0,
    partnerHasRetirement: false,
    partnerRetirementPreTaxPct: 0,
    partnerRetirementRothPct: 0,
    partnerPreTaxDeductionsMonthly: 0,
    filingStatus: "single",
    lifestyleMonthly: 4_000,
    housingMonthly: 2_000,
    debtBalance: 0,
    debtAprPct: 0,
    debtMonthlyPayment: 0,
    assetsCash: 20_000,
    assetsInvestments: 50_000,
    homeValue: 0,
    inflationRate: 0.025,
    returnRate: 0.07,
    cashRate: 0.04,
    flatTaxRate: 0.3,
    stateTaxRate: 0,
  };
}

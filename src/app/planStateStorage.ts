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

  // In the baseline form, these are entered as percentages (e.g. 9 => 0.09).
  const pctToRate = (pct: number | undefined, fallbackRate: number) =>
    typeof pct === "number" && Number.isFinite(pct) ? pct / 100 : fallbackRate;

  const userBonus = form.userBonusAnnual ?? 0;
  const userIncome = {
    baseAnnual: form.userBaseAnnual ?? 0,
    hasBonus: userBonus > 0,
    bonusAnnual: userBonus > 0 ? userBonus : undefined,
    incomeGrowthRate: pctToRate(form.incomeGrowthRate, 0.03),
    preTaxDeductionsMonthly: form.userPreTaxDeductionsMonthly ?? 0,
    retirement: {
      hasPlan: form.userHasRetirement ?? false,
      employeePreTaxContributionPct: form.userRetirementPreTaxPct ?? 0,
      employeeRothContributionPct: form.userRetirementRothPct ?? 0,
      hasEmployerMatch: form.userHasEmployerMatch ?? false,
      employerMatchPct: form.userEmployerMatchPct ?? 0,
      employerMatchUpToPct: form.userEmployerMatchUpToPct ?? 0,
    },
  };

  const partnerBonus = form.partnerBonusAnnual ?? 0;
  const partnerIncome = {
    baseAnnual: form.partnerBaseAnnual ?? 0,
    hasBonus: partnerBonus > 0,
    bonusAnnual: partnerBonus > 0 ? partnerBonus : undefined,
    incomeGrowthRate: pctToRate(form.incomeGrowthRate, 0.03),
    preTaxDeductionsMonthly: form.partnerPreTaxDeductionsMonthly ?? 0,
    retirement: {
      hasPlan: form.partnerHasRetirement ?? false,
      employeePreTaxContributionPct: form.partnerRetirementPreTaxPct ?? 0,
      employeeRothContributionPct: form.partnerRetirementRothPct ?? 0,
      hasEmployerMatch: form.partnerHasEmployerMatch ?? false,
      employerMatchPct: form.partnerEmployerMatchPct ?? 0,
      employerMatchUpToPct: form.partnerEmployerMatchUpToPct ?? 0,
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
      inflationRate: pctToRate(form.inflationRate, 0.025),
      returnRate: pctToRate(form.returnRate, 0.07),
      cashRate: pctToRate(form.cashRate, 0.04),
      flatTaxRate: pctToRate(form.flatTaxRate, 0.3),
      stateTaxRate: pctToRate(form.stateTaxRate, 0),
    },
  };
}

/** Form state for baseline inputs (UI only). */
export type BaselineFormState = {
  asOfYearMonth?: YearMonth;
  startAge?: number;
  endAge?: number;
  userBaseAnnual?: number;
  userBonusAnnual?: number;
  incomeGrowthRate?: number;
  userHasRetirement?: boolean;
  userRetirementPreTaxPct?: number;
  userRetirementRothPct?: number;
  userHasEmployerMatch?: boolean;
  userEmployerMatchPct?: number;
  userEmployerMatchUpToPct?: number;
  userPreTaxDeductionsMonthly?: number;
  hasPartner?: boolean;
  partnerBaseAnnual?: number;
  partnerBonusAnnual?: number;
  partnerHasRetirement?: boolean;
  partnerRetirementPreTaxPct?: number;
  partnerRetirementRothPct?: number;
  partnerHasEmployerMatch?: boolean;
  partnerEmployerMatchPct?: number;
  partnerEmployerMatchUpToPct?: number;
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
  // Rates in the form are entered as percentages (e.g. 9 = 9%).
  const assertPct = (v: number | undefined, label: string, max: number) => {
    if (v == null) return null;
    if (!Number.isFinite(v)) return `${label} must be a valid number.`;
    if (v < 0) return `${label} must be >= 0%.`;
    if (v > max) return `${label} must be <= ${max}%.`;
    return null;
  };
  const pctErr =
    assertPct(form.stateTaxRate, "State tax rate", 30) ??
    assertPct(form.incomeGrowthRate, "Income growth rate", 50) ??
    assertPct(form.inflationRate, "Inflation", 30) ??
    assertPct(form.returnRate, "Investment return", 50) ??
    assertPct(form.cashRate, "Cash return", 30) ??
    assertPct(form.flatTaxRate, "Flat tax rate", 80);
  if (pctErr) return pctErr;
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
    if (form.userHasEmployerMatch) {
      const matchPct = form.userEmployerMatchPct ?? 0;
      const upToPct = form.userEmployerMatchUpToPct ?? 0;
      if (matchPct < 0 || matchPct > 100) return "User employer match % must be between 0 and 100.";
      if (upToPct < 0 || upToPct > 100) return "User employer match up-to % must be between 0 and 100.";
    }
  }
  if (form.hasPartner && form.partnerHasRetirement) {
    const pre = form.partnerRetirementPreTaxPct ?? 0;
    const roth = form.partnerRetirementRothPct ?? 0;
    if (pre < 0 || roth < 0) return "Partner retirement contribution % must be >= 0.";
    if (pre + roth > 100) return "Partner retirement pre-tax % + Roth % must be <= 100.";
    if (form.partnerHasEmployerMatch) {
      const matchPct = form.partnerEmployerMatchPct ?? 0;
      const upToPct = form.partnerEmployerMatchUpToPct ?? 0;
      if (matchPct < 0 || matchPct > 100) return "Partner employer match % must be between 0 and 100.";
      if (upToPct < 0 || upToPct > 100) return "Partner employer match up-to % must be between 0 and 100.";
    }
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

    const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
    const ensureRecord = (obj: Record<string, unknown>, key: string): Record<string, unknown> => {
      const v = obj[key];
      if (isRecord(v)) return v;
      const created: Record<string, unknown> = {};
      obj[key] = created;
      return created;
    };
    const ensureNumber = (obj: Record<string, unknown>, key: string, fallback: number): number => {
      const v = obj[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      obj[key] = fallback;
      return fallback;
    };
    const ensureBoolean = (obj: Record<string, unknown>, key: string, fallback: boolean): boolean => {
      const v = obj[key];
      if (typeof v === "boolean") return v;
      obj[key] = fallback;
      return fallback;
    };

    const parsedUnknown = JSON.parse(raw) as unknown;
    if (!isRecord(parsedUnknown)) return null;
    const parsed = parsedUnknown;

    // Lightweight migration for older saved plans.
    const assumptions = ensureRecord(parsed, "assumptions");
    ensureNumber(assumptions, "inflationRate", 0.025);
    ensureNumber(assumptions, "returnRate", 0.07);
    ensureNumber(assumptions, "cashRate", 0.04);
    ensureNumber(assumptions, "flatTaxRate", 0.3);
    ensureNumber(assumptions, "stateTaxRate", 0);

    const household = ensureRecord(parsed, "household");
    const user = ensureRecord(household, "user");
    const userIncome = ensureRecord(user, "income");
    const userRet = ensureRecord(userIncome, "retirement");
    if (userRet) {
      // If an old single % exists, treat it as pre-tax.
      const legacyPct = userRet["employeeContributionPct"];
      if (userRet["employeePreTaxContributionPct"] == null && typeof legacyPct === "number") {
        userRet["employeePreTaxContributionPct"] = legacyPct;
      }
      ensureNumber(userRet, "employeeRothContributionPct", 0);
      ensureBoolean(userRet, "hasEmployerMatch", false);
      ensureNumber(userRet, "employerMatchPct", 0);
      ensureNumber(userRet, "employerMatchUpToPct", 0);
      delete userRet["employeeContributionPct"];
    }

    const hasPartner = typeof household["hasPartner"] === "boolean" ? household["hasPartner"] : false;
    if (hasPartner) {
      const partner = ensureRecord(household, "partner");
      const partnerIncome = ensureRecord(partner, "income");
      const partnerRet = ensureRecord(partnerIncome, "retirement");
      const legacyPct = partnerRet["employeeContributionPct"];
      if (partnerRet["employeePreTaxContributionPct"] == null && typeof legacyPct === "number") {
        partnerRet["employeePreTaxContributionPct"] = legacyPct;
      }
      ensureNumber(partnerRet, "employeeRothContributionPct", 0);
      ensureBoolean(partnerRet, "hasEmployerMatch", false);
      ensureNumber(partnerRet, "employerMatchPct", 0);
      ensureNumber(partnerRet, "employerMatchUpToPct", 0);
      delete partnerRet["employeeContributionPct"];
    }

    // Defaults/migration for new tax + deductions fields.
    const tax = ensureRecord(household, "tax");
    if (tax["filingStatus"] !== "single" && tax["filingStatus"] !== "marriedJoint") {
      tax["filingStatus"] = hasPartner ? "marriedJoint" : "single";
    }

    ensureNumber(userIncome, "preTaxDeductionsMonthly", 0);
    ensureBoolean(userIncome, "hasBonus", false);
    ensureNumber(userIncome, "bonusAnnual", 0);
    if (hasPartner) {
      const partner = ensureRecord(household, "partner");
      const partnerIncome = ensureRecord(partner, "income");
      ensureNumber(partnerIncome, "preTaxDeductionsMonthly", 0);
      ensureBoolean(partnerIncome, "hasBonus", false);
      ensureNumber(partnerIncome, "bonusAnnual", 0);
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
    userBonusAnnual: 0,
    // Rates in the form are entered as percentages (e.g. 3 = 3%).
    incomeGrowthRate: 3,
    userHasRetirement: true,
    userRetirementPreTaxPct: 10,
    userRetirementRothPct: 0,
    userHasEmployerMatch: false,
    userEmployerMatchPct: 50,
    userEmployerMatchUpToPct: 6,
    userPreTaxDeductionsMonthly: 0,
    hasPartner: false,
    partnerBaseAnnual: 0,
    partnerBonusAnnual: 0,
    partnerHasRetirement: false,
    partnerRetirementPreTaxPct: 0,
    partnerRetirementRothPct: 0,
    partnerHasEmployerMatch: false,
    partnerEmployerMatchPct: 50,
    partnerEmployerMatchUpToPct: 6,
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
    inflationRate: 2.5,
    returnRate: 7,
    cashRate: 4,
    flatTaxRate: 30,
    stateTaxRate: 0,
  };
}

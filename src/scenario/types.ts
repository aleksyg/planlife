import type { YearInputs, Owner } from "@/engine/types/planState";

export type ScenarioWho = "user" | "partner";

export type IncomeSegmentOverride = {
  who: ScenarioWho;
  startYearIndex: number;
  /** Inclusive. If omitted, applies through end of projection. */
  endYearIndexInclusive?: number;
  /** Explicit base annual income at startYearIndex (no compounding implied). */
  baseAnnual: number;
};

export type ExpenseSegmentOverride = {
  kind: "lifestyle" | "housingRent" | "housingPITI";
  startYearIndex: number;
  endYearIndexInclusive?: number;
  monthly: number;
};

export type ContributionSegmentOverride = {
  who: ScenarioWho;
  startYearIndex: number;
  endYearIndexInclusive?: number;
  employeePreTaxPct?: number; // 0..100
  employeeRothPct?: number; // 0..100
  preTaxDeductionsMonthly?: number;
};

export type RatesSegmentOverride = {
  startYearIndex: number;
  endYearIndexInclusive?: number;
  returnRate?: number; // 0..1
  inflationRate?: number; // 0..1
  cashRate?: number; // 0..1
  stateTaxRate?: number; // 0..1
};

export type OneTimeEventOverride = {
  yearIndex: number;
  /**
   * Signed dollars applied in this year:
   * - Negative = spending (reduces assets)
   * - Positive = windfall (increases assets)
   */
  amount: number;
  label: string;
  fromBucket?: "cash" | "brokerage";
  owner?: Owner;
};

export type DebtEventOverride = {
  debtId: string;
  yearIndex: number;
  extraPayment?: number;
};

export type ScenarioOverrides = {
  incomeSegments?: IncomeSegmentOverride[];
  expenseSegments?: ExpenseSegmentOverride[];
  contributionSegments?: ContributionSegmentOverride[];
  ratesSegments?: RatesSegmentOverride[];
  oneTimeEvents?: OneTimeEventOverride[];
  debtEvents?: DebtEventOverride[];
};

// Patches are AI-friendly deltas that mutate ScenarioOverrides deterministically.
export type ScenarioPatch =
  | {
      type: "SetIncomeRange";
      who: ScenarioWho;
      startYearIndex: number;
      endYearIndexInclusive?: number;
      baseAnnual: number;
    }
  | {
      type: "SetExpenseRange";
      kind: ExpenseSegmentOverride["kind"];
      startYearIndex: number;
      endYearIndexInclusive?: number;
      monthly: number;
    }
  | {
      type: "SetContribRange";
      who: ScenarioWho;
      startYearIndex: number;
      endYearIndexInclusive?: number;
      employeePreTaxPct?: number;
      employeeRothPct?: number;
      preTaxDeductionsMonthly?: number;
    }
  | {
      type: "SetRatesRange";
      startYearIndex: number;
      endYearIndexInclusive?: number;
      returnRate?: number;
      inflationRate?: number;
      cashRate?: number;
      stateTaxRate?: number;
    }
  | {
      type: "AddOneTimeEvent";
      yearIndex: number;
      amount: number;
      label: string;
      fromBucket?: "cash" | "brokerage";
    };

export type { YearInputs };


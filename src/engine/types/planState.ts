// ---------- Shared primitives ----------
export type Owner = 'user' | 'partner' | 'joint';

// Month granularity for user-friendly payoff / planning dates.
// Store as "YYYY-MM" (e.g. "2032-06").
export type YearMonth = `${number}-${'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'}`;

// ---------- Household / background ----------
export type Housing =
  | {
      status: 'rent';
      monthlyRent: number;
    }
  | {
      status: 'own';
      monthlyPaymentPITI: number; // includes taxes + insurance
    };

export type Child = {
  id: string; // stable key for add/remove UI (e.g. crypto.randomUUID())
  age: number;
};

// ---------- Taxes (v1 placeholders) ----------
export type TaxFilingStatus = 'single' | 'marriedJoint';

// ---------- Income ----------
export type RetirementPlan = {
  hasPlan: boolean; // 401k/403b/etc
  employeePreTaxContributionPct?: number; // 0–100, required if hasPlan
  employeeRothContributionPct?: number; // 0–100, required if hasPlan

  hasEmployerMatch?: boolean;
  employerMatchPct?: number; // e.g. 50 means "50% match"
  employerMatchUpToPct?: number; // e.g. 6 means "up to 6% of comp"
};

export type Income = {
  baseAnnual: number;

  hasBonus: boolean;
  bonusAnnual?: number; // required if hasBonus

  /**
   * Pre-tax payroll deductions (monthly), e.g. health/vision/dental, commuter benefits.
   * These reduce BOTH federal taxable income and FICA wages (v1 assumption).
   */
  preTaxDeductionsMonthly: number;

  retirement: RetirementPlan;
  incomeGrowthRate: number; // e.g. 0.03

};

export type Person = {
  age: number;
  income: Income;
};

export type Household = {
  user: Person;

  hasPartner: boolean;
  partner?: Person; // required if hasPartner

  tax: {
    filingStatus: TaxFilingStatus;
  };

  hasChildren: boolean;
  children?: Child[]; // add/remove

  housing: Housing;
};

// ---------- Expenses (lifestyle-only) ----------
export type ExpenseLineItem = {
  id: string; // stable key for add/remove UI
  label: string; // editable category label
  monthlyAmount: number;
};

export type Expenses =
  | {
      mode: 'total';
      lifestyleMonthly: number; // excludes housing + debt
    }
  | {
      mode: 'itemized';
      items: ExpenseLineItem[]; // lifestyle-only categories
    };

// ---------- Debt ----------
export type DebtType =
  | 'creditCard'
  | 'studentLoan'
  | 'autoLoan'
  | 'mortgageOther'
  | 'other';

export type Debt = {
  id: string; // stable key for add/remove
  label: string; // editable (e.g. "Amex", "Student Loan", "Car")
  type: DebtType;

  balance: number;
  aprPct: number; // required for calc (e.g. 6.5 for 6.5%)

  payoffYearMonth: YearMonth; // required, month granularity

  /**
   * The UI should compute a suggested monthly payment once balance/apr/payoff are present.
   * User may override; if set, this is the truth used by the engine.
   *
   * UI behavior recommendation:
   * - Store the override separately so you can keep showing "suggested vs actual".
   * - If user edits balance/apr/payoff: recompute suggested; keep override unless user clears it.
   */
  monthlyPayment: number; // editable; treated as truth in engine
  monthlyPaymentIsOverride: boolean; // tracks whether user changed it from suggested
};

// ---------- Balance Sheet ----------
export type AssetType =
  | 'cash'
  | 'brokerage' // taxable investments
  | 'retirementTaxDeferred' // 401k/403b/traditional IRA
  | 'retirementRoth'
  | 'hsa'
  | '529'
  | 'other';

export type AssetAccount = {
  id: string; // stable key for add/remove
  label: string; // editable (e.g. "Checking", "Vanguard Brokerage", "401k")
  type: AssetType;
  owner: Owner;
  balance: number;

  // optional v1 fields (not used immediately)
  costBasis?: number; // only relevant for brokerage
};

export type BalanceSheet = {
  assets: AssetAccount[];

  // Always include home; UI can show/hide based on housing.status if desired.
  home: {
    owner: Owner; // often 'joint'
    currentValue: number;
  };
};

// ---------- PlanState (canonical source of truth) ----------
export type PlanState = {
  // Projection settings
  asOfYearMonth: YearMonth;

  startAge: number;
  endAge: number;

  // Inputs
  household: Household;
  expenses: Expenses;
  debt: Debt[];
  balanceSheet: BalanceSheet;

  // Assumptions (we’ll refine after this is locked)
  assumptions: {
    inflationRate: number; // e.g. 0.025
    returnRate: number; // e.g. 0.07
    cashRate: number; // e.g. 0.04
    flatTaxRate: number; // placeholder (e.g. 0.30)
    stateTaxRate: number; // placeholder (e.g. 0.05)
  };
};

export type { YearInputs, PersonYearInputs, OneTimeEventInput } from './yearInputs';

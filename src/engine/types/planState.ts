export type YesNo = 'yes' | 'no';

export type Housing =
  | {
      status: 'rent';
      monthlyRent: number; // required if rent
    }
  | {
      status: 'own';
      monthlyPaymentPITI: number; // payment including taxes + insurance
    };

export type Child = {
    id: string; // stable key for add/remove UI (e.g. crypto.randomUUID())
    age: number; // v1: just age; later we can add childcare/college toggles etc
};

export type RetirementPlan = {
  hasPlan: boolean; // 401k/403b/etc
  employeeContributionPct?: number; // 0–100, required if hasPlan

  hasEmployerMatch?: boolean; // required if hasPlan? we can decide later
  employerMatchPct?: number; // e.g. 50 means "50% match"
  employerMatchUpToPct?: number; // e.g. 6 means "up to 6% of comp"
};

export type Income = {
  baseAnnual: number;

  hasBonus: boolean;
  bonusAnnual?: number; // required if hasBonus

  retirement: RetirementPlan;
};

export type Person = {
  age: number;
  income: Income;
};

export type Household = {
  user: Person;

  hasPartner: boolean;
  partner?: Person; // required if hasPartner

  hasChildren: boolean;
  children?: Child[]; // v1: start with [ {age} ] and later allow add/remove

  housing: Housing;
};

export type PlanState = {
  // Horizon / projection settings
  startAge: number;
  endAge: number;

  // Household & inputs
  household: Household;

  // Placeholder sections you said we’ll design next
  expenses: Expenses;
  debt: Debt[];
  balanceSheet?: unknown;

  // Assumptions (keep minimal for now)
  assumptions: {
    inflationRate: number; // e.g. 0.025
    returnRate: number; // e.g. 0.07
    cashRate: number; // e.g. 0.04
  };
};

export type ExpenseLineItem = {
  id: string; // stable key for add/remove UI (e.g. crypto.randomUUID())
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

export type DebtType =
  | 'creditCard'
  | 'studentLoan'
  | 'autoLoan'
  | 'mortgageOther'
  | 'other';

export type Debt = {
  id: string;            // stable key for add/remove
  label: string;         // editable (e.g. "Amex", "Student Loan", "Car")
  type: DebtType;

  balance: number;

  aprPct?: number;       // e.g. 19.99

  // User can either provide this OR we compute it later
  requiredMonthlyPayment?: number;

  // New: final payoff date instead of termMonths
  finalPaymentDate?: string; 
  // ISO string recommended: "2032-06-01"
};

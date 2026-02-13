export type OneTimeEventInput = {
  /**
   * Signed dollars applied to savings that year.
   * - Negative = spending (reduces assets)
   * - Positive = windfall (increases assets)
   */
  amount: number;
  label: string;
  fromBucket?: "cash" | "brokerage";
};

export type PersonYearInputs = {
  /** Explicit base annual income for this yearIndex. If provided, ignores compounding. */
  baseAnnual?: number;

  /**
   * Explicit annual bonus income for this yearIndex.
   * If provided, overrides baseline bonus behavior for this year.
   */
  bonusAnnual?: number;

  /** Override retirement contribution configuration for this yearIndex. */
  retirement?: {
    hasPlan?: boolean;
    employeePreTaxContributionPct?: number; // 0..100
    employeeRothContributionPct?: number; // 0..100
    hasEmployerMatch?: boolean;
    employerMatchPct?: number; // 0..100
    employerMatchUpToPct?: number; // 0..100
  };

  /** Override pre-tax payroll deductions (monthly) for this yearIndex. */
  preTaxDeductionsMonthly?: number;
};

export type YearInputs = {
  yearIndex: number;

  user?: PersonYearInputs;
  partner?: PersonYearInputs;

  lifestyleMonthly?: number;
  housingMonthly?: number;

  /** Overrides for assumptions applied in this yearIndex. */
  rates?: {
    returnRate?: number; // 0..1
    inflationRate?: number; // 0..1
    cashRate?: number; // 0..1
    stateTaxRate?: number; // 0..1
  };

  oneTimeEvents?: OneTimeEventInput[];
};


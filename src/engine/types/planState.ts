export type PlanState = {
  birthYear: number;
  startAge: number;
  endAge: number;

  balances: {
    cash: number;
    taxable: number;
    taxDeferred: number;
    roth: number;
  };

  annualIncome: number;
  incomeGrowthRate: number;

  monthlyExpenses: number;
  inflationRate: number;

  returnRate: number;
  cashRate: number;
};

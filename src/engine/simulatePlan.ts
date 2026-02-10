import type { PlanState } from './types/planState';

export type YearRow = {
  age: number;
  yearIndex: number;

  grossIncome: number;
  housingMonthly: number;
  debtMonthly: number;
  lifestyleMonthly: number;

  totalMonthlyOutflow: number;
  annualSavings: number;

  endAssetValue: number; // total assets excluding home unless you choose to include
  endNetWorth: number;   // assets + home - debt balances (later)
};

export function simulatePlan(_plan: PlanState): YearRow[] {
  // v0: stub — logic will come next
  return [];
}

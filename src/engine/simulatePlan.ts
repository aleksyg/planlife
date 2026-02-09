import type { PlanState } from './types/planState';

export type YearRow = {
  age: number;
  yearIndex: number;

  income: number;
  expenses: number;
  savings: number;

  endBalances: {
    cash: number;
    taxable: number;
    taxDeferred: number;
    roth: number;
  };

  netWorth: number;
};

export function simulatePlan(_plan: PlanState): YearRow[] {
  // v0: stub — logic will come next
  return [];
}

import type { PlanState, Housing, Expenses } from './types/planState';

export type YearRow = {
  age: number;
  yearIndex: number;

  grossIncome: number;
  housingMonthly: number;
  debtMonthly: number;
  lifestyleMonthly: number;

  totalMonthlyOutflow: number;
  annualSavings: number;

  endAssetValue: number;
  endNetWorth: number;
};

function getHousingMonthly(housing: Housing): number {
  return housing.status === 'rent' ? housing.monthlyRent : housing.monthlyPaymentPITI;
}

function getLifestyleMonthly(expenses: Expenses): number {
  if (expenses.mode === 'total') return expenses.lifestyleMonthly;
  return expenses.items.reduce((sum, item) => sum + item.monthlyAmount, 0);
}

function getDebtMonthly(plan: PlanState): number {
  return plan.debt.reduce((sum, d) => sum + d.monthlyPayment, 0);
}

function getPersonGrossIncomeAtAge(personAgeNow: number, targetAge: number, income: { baseAnnual: number; hasBonus: boolean; bonusAnnual?: number; incomeGrowthRate: number }): number {
  const yearsForward = targetAge - personAgeNow;
  const growth = Math.pow(1 + income.incomeGrowthRate, Math.max(0, yearsForward));
  const base = income.baseAnnual * growth;
  const bonus = income.hasBonus ? (income.bonusAnnual ?? 0) * growth : 0;
  return base + bonus;
}

function getHouseholdGrossIncomeAtAge(plan: PlanState, targetAge: number): number {
  const user = plan.household.user;
  let total = getPersonGrossIncomeAtAge(user.age, targetAge, user.income);

  if (plan.household.hasPartner && plan.household.partner) {
    const partner = plan.household.partner;
    total += getPersonGrossIncomeAtAge(partner.age, partner.age + (targetAge - user.age), partner.income);
    // Explanation: we advance partner age by the same number of years as the user's age advancement.
  }

  return total;
}

export function simulatePlan(_plan: PlanState): YearRow[] {
  // Step-by-step: we’ll fill this in next.
  return [];
}

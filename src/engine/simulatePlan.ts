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

export function simulatePlan(plan: PlanState): YearRow[] {
  const rows: YearRow[] = [];

  const lifestyleMonthly = getLifestyleMonthly(plan.expenses);
  const housingMonthly = getHousingMonthly(plan.household.housing);
  const debtMonthly = getDebtMonthly(plan);

  const totalMonthlyOutflow = lifestyleMonthly + housingMonthly + debtMonthly;
  const annualOutflow = totalMonthlyOutflow * 12;

  // v1 (cashflow-only): start with total starting assets (excluding home for "asset value")
  const startingAssets = plan.balanceSheet.assets.reduce((sum, a) => sum + a.balance, 0);
  const homeValue = plan.balanceSheet.home.currentValue;

  // We’ll evolve these in Step 3 when we add returns & allocate savings.
  let assetValue = startingAssets;

  const years = plan.endAge - plan.startAge + 1;
  for (let i = 0; i < years; i++) {
    const age = plan.startAge + i;

    const grossIncome = getHouseholdGrossIncomeAtAge(plan, age);

    // v1: no taxes, no retirement contribution logic yet
    const annualSavings = grossIncome - annualOutflow;

    // cashflow-only accumulation: add savings directly to total assets
    assetValue += annualSavings;

    // v1 net worth: assets + home - debt balances (debt balances are principal, not payments)
    const totalDebtBalance = plan.debt.reduce((sum, d) => sum + d.balance, 0);
    const endNetWorth = assetValue + homeValue - totalDebtBalance;

    rows.push({
      age,
      yearIndex: i,

      grossIncome,
      housingMonthly,
      debtMonthly,
      lifestyleMonthly,

      totalMonthlyOutflow,
      annualSavings,

      endAssetValue: assetValue,
      endNetWorth,
    });
  }

  return rows;
}


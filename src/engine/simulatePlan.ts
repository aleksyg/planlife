import type { Expenses, Housing, Person, PlanState } from './types/planState';

export type YearRow = {
  age: number;
  yearIndex: number;

  grossIncome: number;

  housingMonthly: number;
  debtMonthly: number;
  lifestyleMonthly: number;

  totalMonthlyOutflow: number;
  annualSavings: number;

  employeeRetirementAnnual: number;
  employerMatchAnnual: number;
  retirementTotalAnnual: number;

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

type CompAtAge = {
  baseAnnual: number;
  bonusAnnual: number;
  grossAnnual: number;
};

function getPersonCompAtAge(
  personAgeNow: number,
  targetAge: number,
  income: {
    baseAnnual: number;
    hasBonus: boolean;
    bonusAnnual?: number;
    incomeGrowthRate: number;
  },
): CompAtAge {
  const yearsForward = targetAge - personAgeNow;
  const growth = Math.pow(1 + income.incomeGrowthRate, Math.max(0, yearsForward));

  const baseAnnual = income.baseAnnual * growth;
  const bonusAnnual = income.hasBonus ? (income.bonusAnnual ?? 0) * growth : 0;

  return {
    baseAnnual,
    bonusAnnual,
    grossAnnual: baseAnnual + bonusAnnual,
  };
}

function getPersonGrossIncomeAtAge(
  personAgeNow: number,
  targetAge: number,
  income: { baseAnnual: number; hasBonus: boolean; bonusAnnual?: number; incomeGrowthRate: number },
): number {
  return getPersonCompAtAge(personAgeNow, targetAge, income).grossAnnual;
}

function getHouseholdGrossIncomeAtAge(plan: PlanState, targetAge: number): number {
  const user = plan.household.user;
  let total = getPersonGrossIncomeAtAge(user.age, targetAge, user.income);

  if (plan.household.hasPartner && plan.household.partner) {
    const yearsForward = targetAge - user.age;
    const partnerAgeAtTarget = plan.household.partner.age + yearsForward;
    total += getPersonGrossIncomeAtAge(
      plan.household.partner.age,
      partnerAgeAtTarget,
      plan.household.partner.income,
    );
  }

  return total;
}

function getPersonRetirementContribAtAge(person: Person, targetAge: number) {
  const comp = getPersonCompAtAge(person.age, targetAge, person.income);

  // v1: retirement contributions computed on BASE only
  const retirement = person.income.retirement;
  if (!retirement?.hasPlan) return { employee: 0, employer: 0, total: 0 };

  const employeePct = (retirement.employeeContributionPct ?? 0) / 100;
  const employee = comp.baseAnnual * employeePct;

  let employer = 0;
  if (retirement.hasEmployerMatch) {
    const matchRate = (retirement.employerMatchPct ?? 0) / 100;
    const upTo = (retirement.employerMatchUpToPct ?? 0) / 100;
    const matchedPct = Math.min(employeePct, upTo);
    employer = comp.baseAnnual * matchedPct * matchRate;
  }

  return { employee, employer, total: employee + employer };
}

function getHouseholdRetirementContribAtAge(plan: PlanState, targetAge: number) {
  const userContrib = getPersonRetirementContribAtAge(plan.household.user, targetAge);

  let partnerContrib = { employee: 0, employer: 0, total: 0 };
  if (plan.household.hasPartner && plan.household.partner) {
    const yearsForward = targetAge - plan.household.user.age;
    const partnerAgeAtTarget = plan.household.partner.age + yearsForward;

    // Compute partner contributions at their age in that same year
    const partnerAtAge: Person = { ...plan.household.partner, age: partnerAgeAtTarget };
    partnerContrib = getPersonRetirementContribAtAge(partnerAtAge, partnerAgeAtTarget);
  }

  return {
    employee: userContrib.employee + partnerContrib.employee,
    employer: userContrib.employer + partnerContrib.employer,
    total: userContrib.total + partnerContrib.total,
  };
}

export function simulatePlan(plan: PlanState): YearRow[] {
  const rows: YearRow[] = [];

  const lifestyleMonthly = getLifestyleMonthly(plan.expenses);
  const housingMonthly = getHousingMonthly(plan.household.housing);
  const debtMonthly = getDebtMonthly(plan);

  const totalMonthlyOutflow = lifestyleMonthly + housingMonthly + debtMonthly;
  const annualOutflow = totalMonthlyOutflow * 12;

  const homeValue = plan.balanceSheet.home.currentValue;
  const totalDebtBalance = plan.debt.reduce((sum, d) => sum + d.balance, 0);

  // Step 3A: track cash vs non-cash totals
  let cashValue = plan.balanceSheet.assets
    .filter((a) => a.type === 'cash')
    .reduce((sum, a) => sum + a.balance, 0);

  let nonCashValue = plan.balanceSheet.assets
    .filter((a) => a.type !== 'cash')
    .reduce((sum, a) => sum + a.balance, 0);

  const years = plan.endAge - plan.startAge + 1;

  for (let i = 0; i < years; i++) {
    const age = plan.startAge + i;

    const grossIncome = getHouseholdGrossIncomeAtAge(plan, age);
    const annualSavings = grossIncome - annualOutflow;

    // Apply returns
    cashValue *= 1 + plan.assumptions.cashRate;
    nonCashValue *= 1 + plan.assumptions.returnRate;

    // Retirement contributions + match (allocation of savings, match is extra money)
    const retirement = getHouseholdRetirementContribAtAge(plan, age);
    nonCashValue += retirement.total;

    // Remaining savings goes to cash (can be negative)
    cashValue += annualSavings - retirement.total;

    const endAssetValue = cashValue + nonCashValue;
    const endNetWorth = endAssetValue + homeValue - totalDebtBalance;

    rows.push({
      age,
      yearIndex: i,

      grossIncome,

      housingMonthly,
      debtMonthly,
      lifestyleMonthly,

      totalMonthlyOutflow,
      annualSavings,

      employeeRetirementAnnual: retirement.employee,
      employerMatchAnnual: retirement.employer,
      retirementTotalAnnual: retirement.total,

      endAssetValue,
      endNetWorth,
    });
  }

  return rows;
}

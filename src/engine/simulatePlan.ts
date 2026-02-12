import type { Debt, Expenses, Housing, Person, PlanState } from './types/planState';
import {
  computeEmployeePayrollTaxes,
  computeFederalIncomeTax,
  getStandardDeduction,
} from './utils/tax';

export type YearRow = {
  age: number;
  yearIndex: number;

  grossIncome: number;
  taxableIncome: number;
  taxableIncomeAfterDeduction: number;
  standardDeductionUsed: number;
  federalIncomeTax: number;
  stateIncomeTax: number;
  payrollTax: number;
  payrollTaxSocialSecurity: number;
  payrollTaxMedicare: number;
  payrollTaxAdditionalMedicare: number;
  taxesPaid: number;
  afterTaxIncome: number;

  housingMonthly: number;
  debtMonthly: number;
  lifestyleMonthly: number;

  totalMonthlyOutflow: number;
  annualSavings: number;

  employeeRetirementAnnual: number;
  employeeRetirementPreTaxAnnual: number;
  employeeRetirementRothAnnual: number;
  employerMatchAnnual: number;
  retirementTotalAnnual: number;

  endCashValue: number;
  endBrokerageValue: number;
  endRetirementTaxDeferredValue: number;
  endRetirementRothValue: number;
  endAssetValue: number;
  endNetWorth: number;

  totalDebtBalance: number;
  totalDebtPrincipalPaid: number;
  totalDebtInterestPaid: number;
};

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Amortize debts for 12 months; returns updated balances, total principal paid, and total interest
 * paid this year.
 *
 * Interest always accrues. Each month:
 *   balanceAfterInterest = balance + interest
 *   paymentApplied = min(monthlyPayment, balanceAfterInterest)
 *   interestPaid = min(paymentApplied, interest)
 *   principalPaid = max(0, paymentApplied - interest)
 *   newBalance = balanceAfterInterest - paymentApplied
 *
 * When payment < interest (negative amortization), unpaid interest is added to balance; balance
 * can grow. Each debt amortized independently.
 */
function amortizeDebtsForYear(
  debts: Debt[],
  balances: Record<string, number>,
): {
  updatedBalances: Record<string, number>;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
} {
  const nextBalances = { ...balances };
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;

  for (let month = 0; month < 12; month++) {
    for (const debt of debts) {
      const balance = nextBalances[debt.id] ?? debt.balance;
      if (balance <= 0) continue;

      const monthlyRate = debt.aprPct / 100 / 12;
      const interest = round2(balance * monthlyRate);
      const balanceAfterInterest = round2(balance + interest);
      const paymentApplied = round2(
        Math.min(debt.monthlyPayment, balanceAfterInterest),
      );
      const interestPaid = round2(Math.min(paymentApplied, interest));
      const principalPaid = round2(Math.max(0, paymentApplied - interest));
      const newBalance = round2(balanceAfterInterest - paymentApplied);

      nextBalances[debt.id] = newBalance;
      totalPrincipalPaid += principalPaid;
      totalInterestPaid += interestPaid;
    }
  }

  return {
    updatedBalances: nextBalances,
    totalPrincipalPaid: round2(totalPrincipalPaid),
    totalInterestPaid: round2(totalInterestPaid),
  };
}

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

function getHouseholdGrossIncomeAtAge(
  plan: PlanState,
  targetAge: number,
  opts?: { partnerZeroFromYearIndex?: number; yearIndex?: number },
): number {
  const user = plan.household.user;
  let total = getPersonGrossIncomeAtAge(user.age, targetAge, user.income);

  const zeroPartner =
    opts?.partnerZeroFromYearIndex !== undefined &&
    opts?.yearIndex !== undefined &&
    opts.yearIndex >= opts.partnerZeroFromYearIndex;

  if (plan.household.hasPartner && plan.household.partner && !zeroPartner) {
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
  if (!retirement?.hasPlan) {
    return {
      employeePreTax: 0,
      employeeRoth: 0,
      employeeTotal: 0,
      employer: 0,
      total: 0,
    };
  }

  const employeePreTaxPct = (retirement.employeePreTaxContributionPct ?? 0) / 100;
  const employeeRothPct = (retirement.employeeRothContributionPct ?? 0) / 100;
  const employeeTotalPct = employeePreTaxPct + employeeRothPct;

  const employeePreTax = comp.baseAnnual * employeePreTaxPct;
  const employeeRoth = comp.baseAnnual * employeeRothPct;
  const employeeTotal = employeePreTax + employeeRoth;

  let employer = 0;
  if (retirement.hasEmployerMatch) {
    const matchRate = (retirement.employerMatchPct ?? 0) / 100;
    const upTo = (retirement.employerMatchUpToPct ?? 0) / 100;
    const matchedPct = Math.min(employeeTotalPct, upTo);
    employer = comp.baseAnnual * matchedPct * matchRate;
  }

  return { employeePreTax, employeeRoth, employeeTotal, employer, total: employeeTotal + employer };
}

function getHouseholdRetirementContribAtAge(
  plan: PlanState,
  targetAge: number,
  opts?: { partnerZeroFromYearIndex?: number; yearIndex?: number },
) {
  const userContrib = getPersonRetirementContribAtAge(plan.household.user, targetAge);

  const zeroPartner =
    opts?.partnerZeroFromYearIndex !== undefined &&
    opts?.yearIndex !== undefined &&
    opts.yearIndex >= opts.partnerZeroFromYearIndex;

  let partnerContrib = {
    employeePreTax: 0,
    employeeRoth: 0,
    employeeTotal: 0,
    employer: 0,
    total: 0,
  };
  if (plan.household.hasPartner && plan.household.partner && !zeroPartner) {
    const yearsForward = targetAge - plan.household.user.age;
    const partnerAgeAtTarget = plan.household.partner.age + yearsForward;

    // Compute partner contributions at their age in that same year
    const partnerAtAge: Person = { ...plan.household.partner, age: partnerAgeAtTarget };
    partnerContrib = getPersonRetirementContribAtAge(partnerAtAge, partnerAgeAtTarget);
  }

  return {
    employeePreTax: userContrib.employeePreTax + partnerContrib.employeePreTax,
    employeeRoth: userContrib.employeeRoth + partnerContrib.employeeRoth,
    employeeTotal: userContrib.employeeTotal + partnerContrib.employeeTotal,
    employer: userContrib.employer + partnerContrib.employer,
    total: userContrib.total + partnerContrib.total,
  };
}

/** Options for scenario runs (e.g. partner quits from a given year index). */
export type SimulatePlanOptions = {
  /** From this year index onward, partner income and retirement contrib are treated as 0. */
  partnerZeroIncomeFromYearIndex?: number;

  /**
   * From this year index onward, override housing monthly as rent.
   * Useful for time-based scenarios without mutating the baseline PlanState.
   */
  housingMonthlyRentFromYearIndex?: number;
  housingMonthlyRentOverride?: number;
};

export function simulatePlan(plan: PlanState, options?: SimulatePlanOptions): YearRow[] {
  const rows: YearRow[] = [];
  const partnerZeroFromYearIndex = options?.partnerZeroIncomeFromYearIndex;

  const lifestyleMonthly = getLifestyleMonthly(plan.expenses);
  const baselineHousingMonthly = getHousingMonthly(plan.household.housing);
  const debtMonthly = getDebtMonthly(plan);

  const housingOverrideFromYearIndex = options?.housingMonthlyRentFromYearIndex;
  const housingOverrideMonthly = options?.housingMonthlyRentOverride;

  const homeValue = plan.balanceSheet.home.currentValue;

  // Per-debt balances (amortized year-over-year)
  let debtBalances: Record<string, number> = {};
  for (const d of plan.debt) {
    debtBalances[d.id] = d.balance;
  }

  // Track separate balances for future tax-aware withdrawal logic.
  let cashValue = 0;
  let brokerageValue = 0;
  let retirementTaxDeferredValue = 0;
  let retirementRothValue = 0;
  for (const a of plan.balanceSheet.assets) {
    if (a.type === 'cash') cashValue += a.balance;
    else if (a.type === 'retirementTaxDeferred') retirementTaxDeferredValue += a.balance;
    else if (a.type === 'retirementRoth') retirementRothValue += a.balance;
    else brokerageValue += a.balance; // v1: everything else treated as taxable investments
  }

  const years = plan.endAge - plan.startAge + 1;
  const incomeOpts =
    partnerZeroFromYearIndex !== undefined
      ? { partnerZeroFromYearIndex, yearIndex: 0 }
      : undefined;

  for (let i = 0; i < years; i++) {
    const age = plan.startAge + i;
    if (incomeOpts) incomeOpts.yearIndex = i;

    const housingMonthly =
      housingOverrideFromYearIndex !== undefined &&
      housingOverrideMonthly !== undefined &&
      i >= housingOverrideFromYearIndex
        ? housingOverrideMonthly
        : baselineHousingMonthly;
    const totalMonthlyOutflow = lifestyleMonthly + housingMonthly + debtMonthly;
    const annualOutflow = totalMonthlyOutflow * 12;

    // Amortize debts for 12 months (monthly inner loop).
    // Runs before cashflow; both use same scheduled payments. When we stop payments mid-year,
    // amortization and annualOutflow should align (reduce outflow for months after payoff).
    const { updatedBalances, totalPrincipalPaid, totalInterestPaid } =
      amortizeDebtsForYear(plan.debt, debtBalances);
    debtBalances = updatedBalances;

    const totalDebtBalance = round2(
      plan.debt.reduce((sum, d) => sum + (debtBalances[d.id] ?? 0), 0),
    );

    const grossIncome = getHouseholdGrossIncomeAtAge(plan, age, incomeOpts);
    const retirement = getHouseholdRetirementContribAtAge(plan, age, incomeOpts);

    // Taxes (v1): federal income tax (brackets + standard deduction) + employee-side payroll taxes.
    const filingStatus = plan.household.tax.filingStatus;

    const userComp = getPersonCompAtAge(plan.household.user.age, age, plan.household.user.income);

    const zeroPartner =
      incomeOpts?.partnerZeroFromYearIndex !== undefined &&
      incomeOpts?.yearIndex !== undefined &&
      incomeOpts.yearIndex >= incomeOpts.partnerZeroFromYearIndex;

    let partnerComp: CompAtAge | null = null;
    if (plan.household.hasPartner && plan.household.partner && !zeroPartner) {
      const yearsForward = age - plan.household.user.age;
      const partnerAgeAtTarget = plan.household.partner.age + yearsForward;
      partnerComp = getPersonCompAtAge(
        plan.household.partner.age,
        partnerAgeAtTarget,
        plan.household.partner.income,
      );
    }

    const userPreTaxDeductionsAnnual = round2(
      (plan.household.user.income.preTaxDeductionsMonthly ?? 0) * 12,
    );
    const partnerPreTaxDeductionsAnnual = round2(
      partnerComp ? (plan.household.partner!.income.preTaxDeductionsMonthly ?? 0) * 12 : 0,
    );
    const householdPreTaxDeductionsAnnual = round2(
      userPreTaxDeductionsAnnual + partnerPreTaxDeductionsAnnual,
    );

    const taxableIncome = Math.max(
      0,
      grossIncome - retirement.employeePreTax - householdPreTaxDeductionsAnnual,
    );
    const standardDeductionUsed = getStandardDeduction(filingStatus);
    const taxableIncomeAfterDeduction = Math.max(
      0,
      taxableIncome - standardDeductionUsed,
    );

    const federalIncomeTax = computeFederalIncomeTax(
      taxableIncomeAfterDeduction,
      filingStatus,
    );

    // Placeholder state tax (v1): apply a flat rate to taxable income after standard deduction.
    const stateTaxRate = plan.assumptions.stateTaxRate ?? 0;
    const stateIncomeTax = round2(taxableIncomeAfterDeduction * stateTaxRate);

    // FICA wages are reduced by pre-tax payroll deductions (but NOT by 401k pre-tax contributions).
    const userFicaWages = Math.max(0, userComp.grossAnnual - userPreTaxDeductionsAnnual);
    const partnerFicaWages = Math.max(
      0,
      (partnerComp?.grossAnnual ?? 0) - partnerPreTaxDeductionsAnnual,
    );
    const payroll = computeEmployeePayrollTaxes(
      { user: userFicaWages, partner: partnerFicaWages },
      filingStatus,
    );

    const payrollTax = payroll.total;
    const taxesPaid = round2(federalIncomeTax + stateIncomeTax + payrollTax);

    // After-tax income is after pre-tax retirement, pre-tax payroll deductions, and taxes.
    const afterTaxIncome = round2(
      grossIncome - retirement.employeePreTax - householdPreTaxDeductionsAnnual - taxesPaid,
    );

    // Payroll-correct cashflow: Roth is deducted after tax; outflows come from take-home.
    const takeHomeAfterRoth = afterTaxIncome - retirement.employeeRoth;
    const annualSavings = takeHomeAfterRoth - annualOutflow;

    // Apply returns
    cashValue *= 1 + plan.assumptions.cashRate;
    brokerageValue *= 1 + plan.assumptions.returnRate;
    retirementTaxDeferredValue *= 1 + plan.assumptions.returnRate;
    retirementRothValue *= 1 + plan.assumptions.returnRate;

    // Route contributions to buckets.
    retirementTaxDeferredValue += retirement.employeePreTax + retirement.employer;
    retirementRothValue += retirement.employeeRoth;

    // Non-retirement savings allocation (v1 rule):
    // - Maintain a 6-month cash buffer (based on totalMonthlyOutflow).
    // - Positive savings fill cash up to the target; overflow goes to brokerage.
    // - Negative savings reduce cash (we don't force brokerage sales in v1).
    const cashTarget = round2(6 * totalMonthlyOutflow);
    if (annualSavings >= 0) {
      const cashNeeded = round2(Math.max(0, cashTarget - cashValue));
      const toCash = round2(Math.min(annualSavings, cashNeeded));
      const toBrokerage = round2(annualSavings - toCash);

      cashValue = round2(cashValue + toCash);
      brokerageValue = round2(brokerageValue + toBrokerage);
    } else {
      cashValue = round2(cashValue + annualSavings);
    }

    // Clamp tiny negative noise to 0 for stability.
    if (Math.abs(cashValue) < 0.005) cashValue = 0;
    if (Math.abs(brokerageValue) < 0.005) brokerageValue = 0;
    if (Math.abs(retirementTaxDeferredValue) < 0.005) retirementTaxDeferredValue = 0;
    if (Math.abs(retirementRothValue) < 0.005) retirementRothValue = 0;

    const endAssetValue =
      cashValue + brokerageValue + retirementTaxDeferredValue + retirementRothValue;
    const endNetWorth = endAssetValue + homeValue - totalDebtBalance;

    rows.push({
      age,
      yearIndex: i,

      grossIncome,
      taxableIncome,
      taxableIncomeAfterDeduction,
      standardDeductionUsed,
      federalIncomeTax,
      stateIncomeTax,
      payrollTax,
      payrollTaxSocialSecurity: payroll.socialSecurity,
      payrollTaxMedicare: payroll.medicare,
      payrollTaxAdditionalMedicare: payroll.additionalMedicare,
      taxesPaid,
      afterTaxIncome,

      housingMonthly,
      debtMonthly,
      lifestyleMonthly,

      totalMonthlyOutflow,
      annualSavings,

      employeeRetirementAnnual: retirement.employeeTotal,
      employeeRetirementPreTaxAnnual: retirement.employeePreTax,
      employeeRetirementRothAnnual: retirement.employeeRoth,
      employerMatchAnnual: retirement.employer,
      retirementTotalAnnual: retirement.total,

      endCashValue: cashValue,
      endBrokerageValue: brokerageValue,
      endRetirementTaxDeferredValue: retirementTaxDeferredValue,
      endRetirementRothValue: retirementRothValue,
      endAssetValue,
      endNetWorth,

      totalDebtBalance,
      totalDebtPrincipalPaid: totalPrincipalPaid,
      totalDebtInterestPaid: totalInterestPaid,
    });
  }

  return rows;
}

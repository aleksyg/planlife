import { simulatePlan } from '../src/engine/simulatePlan';
import type { PlanState } from '../src/engine/types/planState';

const plan: PlanState = {
  asOfYearMonth: '2026-02',
  startAge: 30,
  endAge: 35,

  household: {
    user: {
      age: 30,
      income: {
        baseAnnual: 150_000,
        hasBonus: true,
        bonusAnnual: 25_000,
        incomeGrowthRate: 0.03,
        preTaxDeductionsMonthly: 200,
        retirement: {
          hasPlan: true,
          employeePreTaxContributionPct: 8,
          employeeRothContributionPct: 2,
          hasEmployerMatch: true,
          employerMatchPct: 50,
          employerMatchUpToPct: 6,
        },
      },
    },

    hasPartner: true,
    partner: {
      age: 30,
      income: {
        baseAnnual: 120_000,
        hasBonus: false,
        incomeGrowthRate: 0.03,
        preTaxDeductionsMonthly: 150,
        retirement: { hasPlan: false },
      },
    },

    hasChildren: true,
    children: [{ id: 'child-1', age: 1 }],

    tax: { filingStatus: 'marriedJoint' },
    housing: { status: 'rent', monthlyRent: 3_500 },
  },

  expenses: {
    mode: 'total',
    lifestyleMonthly: 5_000,
  },

  debt: [
    {
      id: 'loan-1',
      label: 'Car',
      type: 'autoLoan',
      balance: 18_000,
      aprPct: 6.5,
      payoffYearMonth: '2028-06',
      monthlyPayment: 550,
      monthlyPaymentIsOverride: false,
    },
  ],

  balanceSheet: {
    assets: [
      { id: 'a1', label: 'Checking', type: 'cash', owner: 'joint', balance: 20_000 },
      { id: 'a2', label: 'Brokerage', type: 'brokerage', owner: 'joint', balance: 80_000 },
      { id: 'a3', label: '401k', type: 'retirementTaxDeferred', owner: 'user', balance: 60_000 },
      { id: 'a4', label: 'Roth IRA', type: 'retirementRoth', owner: 'user', balance: 15_000 },
    ],
    home: { owner: 'joint', currentValue: 0 }, // renting in this demo
  },

  assumptions: {
    inflationRate: 0.025,
    returnRate: 0.07,
    cashRate: 0.04,
    flatTaxRate: 0.3,
    stateTaxRate: 0.05,
  },
};

const rows = simulatePlan(plan);

// Sanity test: underpaying debt — $5k at 30% APR, $50/mo. Interest ~$125/mo > payment; balance should grow.
const underpayPlan: PlanState = {
  ...plan,
  debt: [
    {
      id: 'underpay-1',
      label: 'Underpaying loan',
      type: 'other',
      balance: 5_000,
      aprPct: 30,
      payoffYearMonth: '2030-01',
      monthlyPayment: 50,
      monthlyPaymentIsOverride: true,
    },
  ],
};
const underpayRows = simulatePlan(underpayPlan);
const r0 = underpayRows[0];
console.log('\n--- Sanity: underpaying debt ($5k @ 30% APR, $50/mo) ---');
console.log('Year 0 start balance: 5000');
console.log('Year 0 end balance:', r0.totalDebtBalance);
console.log('Year 0 principal paid:', r0.totalDebtPrincipalPaid);
console.log('Year 0 interest paid:', r0.totalDebtInterestPaid);
console.log(
  'Balance grew?',
  r0.totalDebtBalance > 5000 ? 'YES ✓' : 'NO (bug)',
);

console.log('\n--- Main plan ---');
console.log('Rows:', rows.length);
console.log('First row:', rows[0]);
console.log('Second row:', rows[1]);
console.log('Last row:', rows[rows.length - 1]);
console.log(
  'Debt tracking:',
  rows.map((r) => ({
    yearIndex: r.yearIndex,
    totalDebtBalance: r.totalDebtBalance,
    totalDebtPrincipalPaid: r.totalDebtPrincipalPaid,
    totalDebtInterestPaid: r.totalDebtInterestPaid,
    endNetWorth: r.endNetWorth,
  })),
);

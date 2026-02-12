import { simulatePlan } from "../src/engine/simulatePlan";
import type { PlanState } from "../src/engine/types/planState";
import {
  computeEmployeePayrollTaxes,
  computeFederalIncomeTax,
  TAX_POLICY_2026,
} from "../src/engine/utils/tax";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertApprox(actual: number, expected: number, eps: number, message: string) {
  const ok = Math.abs(actual - expected) <= eps;
  assert(
    ok,
    `${message}. expected=${expected} actual=${actual} diff=${actual - expected}`,
  );
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function testFederalBracketEdges() {
  // Single: 10% up to 12,400; then 12%
  const t0 = computeFederalIncomeTax(12_400, "single", TAX_POLICY_2026);
  const t1 = computeFederalIncomeTax(12_401, "single", TAX_POLICY_2026);
  assertApprox(t0, 1_240, 0.0001, "single tax at 12,400");
  assertApprox(t1, 1_240.12, 0.01, "single tax at 12,401 adds 12% on $1");

  // MFJ: 10% up to 24,800; then 12%
  const m0 = computeFederalIncomeTax(24_800, "marriedJoint", TAX_POLICY_2026);
  const m1 = computeFederalIncomeTax(24_801, "marriedJoint", TAX_POLICY_2026);
  assertApprox(m0, 2_480, 0.0001, "MFJ tax at 24,800");
  assertApprox(m1, 2_480.12, 0.01, "MFJ tax at 24,801 adds 12% on $1");
}

function testPayrollEdges() {
  // Social Security wage base is per-person capped.
  const payroll1 = computeEmployeePayrollTaxes(
    { user: 300_000, partner: 50_000 },
    "marriedJoint",
    TAX_POLICY_2026,
  );
  const ssUser = TAX_POLICY_2026.socialSecurityWageBase * TAX_POLICY_2026.socialSecurityRate;
  const ssPartner = 50_000 * TAX_POLICY_2026.socialSecurityRate;
  assertApprox(
    payroll1.socialSecurity,
    Math.round((ssUser + ssPartner) * 100) / 100,
    0.01,
    "SS tax caps per person",
  );

  // Both spouses above wage base => SS tax is 2 * wageBase * rate.
  const payroll2 = computeEmployeePayrollTaxes(
    { user: 500_000, partner: 500_000 },
    "marriedJoint",
    TAX_POLICY_2026,
  );
  const ssBoth =
    2 * TAX_POLICY_2026.socialSecurityWageBase * TAX_POLICY_2026.socialSecurityRate;
  assertApprox(payroll2.socialSecurity, ssBoth, 0.01, "SS cap applies to both spouses");

  // Additional Medicare threshold is filing-status based (MFJ 250k).
  const p0 = computeEmployeePayrollTaxes({ user: 250_000, partner: 0 }, "marriedJoint", TAX_POLICY_2026);
  const p1 = computeEmployeePayrollTaxes({ user: 250_001, partner: 0 }, "marriedJoint", TAX_POLICY_2026);
  assertApprox(p0.additionalMedicare, 0, 0.0001, "Additional Medicare at threshold is 0");
  // $1 over threshold at 0.9% rounds to $0.01
  assertApprox(p1.additionalMedicare, 0.01, 0.01, "Additional Medicare $1 over threshold rounds to 1 cent");

  // Additional Medicare combines wages for MFJ threshold.
  const p2 = computeEmployeePayrollTaxes(
    { user: 200_000, partner: 60_000 },
    "marriedJoint",
    TAX_POLICY_2026,
  );
  // $10k over MFJ threshold => 0.9% * 10,000 = 90.00
  assertApprox(p2.additionalMedicare, 90, 0.01, "Additional Medicare uses combined wages");
}

function testSimulatePlanInvariants() {
  const plan: PlanState = {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge: 35,
    household: {
      user: {
        age: 30,
        income: {
          baseAnnual: 200_000,
          hasBonus: false,
          incomeGrowthRate: 0.0,
          preTaxDeductionsMonthly: 300,
          retirement: {
            hasPlan: true,
            employeePreTaxContributionPct: 5,
            employeeRothContributionPct: 5,
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
          baseAnnual: 900_000,
          hasBonus: false,
          incomeGrowthRate: 0.0,
          preTaxDeductionsMonthly: 500,
          retirement: { hasPlan: false },
        },
      },
      tax: { filingStatus: "marriedJoint" },
      hasChildren: false,
      housing: { status: "rent", monthlyRent: 4_000 },
    },
    expenses: { mode: "total", lifestyleMonthly: 6_000 },
    debt: [],
    balanceSheet: {
      assets: [
        { id: "c1", label: "Cash", type: "cash", owner: "joint", balance: 50_000 },
        { id: "b1", label: "Brokerage", type: "brokerage", owner: "joint", balance: 100_000 },
        { id: "t1", label: "401k", type: "retirementTaxDeferred", owner: "user", balance: 75_000 },
        { id: "r1", label: "Roth", type: "retirementRoth", owner: "user", balance: 25_000 },
      ],
      home: { owner: "joint", currentValue: 0 },
    },
    assumptions: {
      inflationRate: 0,
      returnRate: 0.07,
      cashRate: 0.04,
      flatTaxRate: 0.3, // ignored by current engine tax model
      stateTaxRate: 0.05,
    },
  };

  const rows = simulatePlan(plan);
  assert(rows.length === 6, "expected 6 rows for ages 30-35");

  for (const r of rows) {
    // Taxes reconcile
    assertApprox(
      r.taxesPaid,
      r.federalIncomeTax + r.stateIncomeTax + r.payrollTax,
      0.01,
      `tax identity yearIndex=${r.yearIndex}`,
    );
    assertApprox(
      r.payrollTax,
      r.payrollTaxSocialSecurity + r.payrollTaxMedicare + r.payrollTaxAdditionalMedicare,
      0.01,
      `payroll identity yearIndex=${r.yearIndex}`,
    );

    // Asset buckets reconcile
    assertApprox(
      r.endAssetValue,
      r.endCashValue +
        r.endBrokerageValue +
        r.endRetirementTaxDeferredValue +
        r.endRetirementRothValue,
      0.01,
      `asset identity yearIndex=${r.yearIndex}`,
    );

    // Standard deduction + taxable after deduction reconcile
    assertApprox(
      r.taxableIncomeAfterDeduction,
      Math.max(0, r.taxableIncome - r.standardDeductionUsed),
      0.01,
      `deduction identity yearIndex=${r.yearIndex}`,
    );
    assertApprox(
      r.standardDeductionUsed,
      TAX_POLICY_2026.standardDeduction.marriedJoint,
      0.0001,
      `standard deduction yearIndex=${r.yearIndex}`,
    );
    assert(r.taxableIncomeAfterDeduction <= r.taxableIncome, "taxable after deduction must be <= taxable");

    // State tax base (flat placeholder): post-deduction taxable income.
    assertApprox(
      r.stateIncomeTax,
      round2(r.taxableIncomeAfterDeduction * 0.05),
      0.01,
      `state tax base yearIndex=${r.yearIndex}`,
    );

    // Non-negativity / clamps
    assert(r.taxableIncomeAfterDeduction >= 0, "taxableIncomeAfterDeduction must be >= 0");
    assert(r.standardDeductionUsed >= 0, "standardDeductionUsed must be >= 0");
  }
}

function testCashBufferAllocation() {
  // Make sure we hit cashTarget in year 0, then overflow invests.
  const plan: PlanState = {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge: 32,
    household: {
      user: {
        age: 30,
        income: {
          baseAnnual: 200_000,
          hasBonus: false,
          incomeGrowthRate: 0,
          preTaxDeductionsMonthly: 0,
          retirement: { hasPlan: false },
        },
      },
      hasPartner: false,
      tax: { filingStatus: "single" },
      hasChildren: false,
      housing: { status: "rent", monthlyRent: 0 },
    },
    expenses: { mode: "total", lifestyleMonthly: 1_000 },
    debt: [],
    balanceSheet: {
      assets: [],
      home: { owner: "joint", currentValue: 0 },
    },
    assumptions: {
      inflationRate: 0,
      returnRate: 0.07,
      cashRate: 0.04,
      flatTaxRate: 0.3,
      stateTaxRate: 0,
    },
  };

  const rows = simulatePlan(plan);
  const cashTarget = 6 * 1_000; // 6 months of totalMonthlyOutflow
  assertApprox(rows[0].endCashValue, cashTarget, 0.01, "year 0 cash fills to target");
  assert(rows[0].endBrokerageValue > 0, "year 0 overflow goes to brokerage");
  assert(rows[1].endCashValue > cashTarget, "year 1 cash can exceed target via cash returns");
  assert(rows[1].endBrokerageValue > rows[0].endBrokerageValue, "brokerage grows/receives overflow");
}

function testQuitPartnerScenarioIncomeDrop() {
  const plan: PlanState = {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge: 34,
    household: {
      user: {
        age: 30,
        income: {
          baseAnnual: 100_000,
          hasBonus: false,
          incomeGrowthRate: 0,
          preTaxDeductionsMonthly: 0,
          retirement: { hasPlan: false },
        },
      },
      hasPartner: true,
      partner: {
        age: 30,
        income: {
          baseAnnual: 50_000,
          hasBonus: false,
          incomeGrowthRate: 0,
          preTaxDeductionsMonthly: 0,
          retirement: { hasPlan: false },
        },
      },
      tax: { filingStatus: "marriedJoint" },
      hasChildren: false,
      housing: { status: "rent", monthlyRent: 0 },
    },
    expenses: { mode: "total", lifestyleMonthly: 2_000 },
    debt: [],
    balanceSheet: { assets: [], home: { owner: "joint", currentValue: 0 } },
    assumptions: {
      inflationRate: 0,
      returnRate: 0.07,
      cashRate: 0.04,
      flatTaxRate: 0.3,
      stateTaxRate: 0,
    },
  };

  const baseline = simulatePlan(plan);
  const scenario = simulatePlan(plan, { partnerZeroIncomeFromYearIndex: 2 });
  for (let i = 0; i < baseline.length; i++) {
    if (i < 2) {
      assertApprox(
        scenario[i].grossIncome,
        baseline[i].grossIncome,
        0.01,
        `scenario income matches baseline before quit yearIndex=${i}`,
      );
    } else {
      assert(
        scenario[i].grossIncome < baseline[i].grossIncome,
        `scenario income drops after quit yearIndex=${i}`,
      );
      assertApprox(
        baseline[i].grossIncome - scenario[i].grossIncome,
        50_000,
        0.01,
        `income drop equals partner base after quit yearIndex=${i}`,
      );
    }
  }
}

function testNegativeSavingsDoesNotForceBrokerageSales() {
  const plan: PlanState = {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge: 31,
    household: {
      user: {
        age: 30,
        income: {
          baseAnnual: 50_000,
          hasBonus: false,
          incomeGrowthRate: 0,
          preTaxDeductionsMonthly: 0,
          retirement: { hasPlan: false },
        },
      },
      hasPartner: false,
      tax: { filingStatus: "single" },
      hasChildren: false,
      housing: { status: "rent", monthlyRent: 0 },
    },
    expenses: { mode: "total", lifestyleMonthly: 8_000 }, // force negative savings
    debt: [],
    balanceSheet: {
      assets: [
        { id: "c1", label: "Cash", type: "cash", owner: "joint", balance: 50_000 },
        { id: "b1", label: "Brokerage", type: "brokerage", owner: "joint", balance: 100_000 },
      ],
      home: { owner: "joint", currentValue: 0 },
    },
    assumptions: {
      inflationRate: 0,
      returnRate: 0.07,
      cashRate: 0.0, // isolate effect
      flatTaxRate: 0.3,
      stateTaxRate: 0.0,
    },
  };

  const rows = simulatePlan(plan);
  assert(rows[0].annualSavings < 0, "expected negative savings year 0");

  // No forced brokerage sales: brokerage should only move by returns (no contributions).
  const expectedBrokerage0 = round2(100_000 * 1.07);
  assertApprox(rows[0].endBrokerageValue, expectedBrokerage0, 0.02, "brokerage grows by returns only");
  assert(rows[0].endCashValue < 50_000, "cash absorbs drawdown first");
}

function testHousingOverrideFromYearIndex() {
  const plan: PlanState = {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge: 32,
    household: {
      user: {
        age: 30,
        income: {
          baseAnnual: 200_000,
          hasBonus: false,
          incomeGrowthRate: 0.0,
          preTaxDeductionsMonthly: 0,
          retirement: { hasPlan: false },
        },
      },
      hasPartner: false,
      tax: { filingStatus: "single" },
      hasChildren: false,
      housing: { status: "rent", monthlyRent: 2_000 },
    },
    expenses: { mode: "total", lifestyleMonthly: 3_000 },
    debt: [],
    balanceSheet: { assets: [], home: { owner: "joint", currentValue: 0 } },
    assumptions: {
      inflationRate: 0.0,
      returnRate: 0.0,
      cashRate: 0.0,
      flatTaxRate: 0.3,
      stateTaxRate: 0.0,
    },
  };

  const base = simulatePlan(plan);
  const scen = simulatePlan(plan, {
    housingMonthlyRentFromYearIndex: 1,
    housingMonthlyRentOverride: 10_000,
  });

  assert(base[0].housingMonthly === 2_000, "baseline year 0 housingMonthly");
  assert(base[1].housingMonthly === 2_000, "baseline year 1 housingMonthly");
  assert(scen[0].housingMonthly === 2_000, "scenario year 0 housingMonthly unchanged");
  assert(scen[1].housingMonthly === 10_000, "scenario year 1 housingMonthly overridden");
  assert(scen[2].housingMonthly === 10_000, "scenario year 2 housingMonthly overridden");
}

function main() {
  testFederalBracketEdges();
  testPayrollEdges();
  testSimulatePlanInvariants();
  testCashBufferAllocation();
  testQuitPartnerScenarioIncomeDrop();
  testNegativeSavingsDoesNotForceBrokerageSales();
  testHousingOverrideFromYearIndex();
  console.log("engine assertions: OK");
}

main();


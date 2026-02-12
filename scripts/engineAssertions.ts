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

  // Additional Medicare threshold is filing-status based (MFJ 250k).
  const p0 = computeEmployeePayrollTaxes({ user: 250_000, partner: 0 }, "marriedJoint", TAX_POLICY_2026);
  const p1 = computeEmployeePayrollTaxes({ user: 250_001, partner: 0 }, "marriedJoint", TAX_POLICY_2026);
  assertApprox(p0.additionalMedicare, 0, 0.0001, "Additional Medicare at threshold is 0");
  // $1 over threshold at 0.9% rounds to $0.01
  assertApprox(p1.additionalMedicare, 0.01, 0.01, "Additional Medicare $1 over threshold rounds to 1 cent");
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

    // Non-negativity / clamps
    assert(r.taxableIncomeAfterDeduction >= 0, "taxableIncomeAfterDeduction must be >= 0");
    assert(r.standardDeductionUsed >= 0, "standardDeductionUsed must be >= 0");
  }
}

function main() {
  testFederalBracketEdges();
  testPayrollEdges();
  testSimulatePlanInvariants();
  console.log("engine assertions: OK");
}

main();


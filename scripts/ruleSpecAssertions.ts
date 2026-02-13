import { simulatePlan } from "../src/engine/simulatePlan";
import type { PlanState, YearInputs } from "../src/engine/types/planState";
import {
  buildScenarioYearInputsFromOverrides,
  buildSeries,
  deriveRuleSpecInputsFromPlanState,
} from "../src/rulespec/index";
import type { Override } from "../src/rulespec/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertApprox(actual: number, expected: number, eps: number, message: string) {
  const ok = Math.abs(actual - expected) <= eps;
  assert(ok, `${message}. expected=${expected} actual=${actual} diff=${actual - expected}`);
}

function mkPlan(): PlanState {
  return {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge: 33,
    household: {
      user: {
        age: 30,
        income: {
          baseAnnual: 100_000,
          hasBonus: true,
          bonusAnnual: 20_000,
          incomeGrowthRate: 0.05,
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
      inflationRate: 0,
      returnRate: 0,
      cashRate: 0,
      flatTaxRate: 0.3,
      stateTaxRate: 0,
    },
  };
}

function testBaselineParityViaYearInputs() {
  const plan = mkPlan();
  const base = simulatePlan(plan);
  const yi = buildScenarioYearInputsFromOverrides(plan, []);
  const scen = simulatePlan(plan, { yearInputs: yi });

  assert(base.length === yi.length, "baseline rows and yearInputs should have same length");
  assert(scen.length === base.length, "scenario rows should match baseline length");

  for (let i = 0; i < base.length; i++) {
    assertApprox(scen[i]!.grossIncome, base[i]!.grossIncome, 0.01, `grossIncome parity yearIndex=${i}`);
    assertApprox(scen[i]!.taxesPaid, base[i]!.taxesPaid, 0.02, `taxesPaid parity yearIndex=${i}`);
    assertApprox(scen[i]!.afterTaxIncome, base[i]!.afterTaxIncome, 0.02, `afterTaxIncome parity yearIndex=${i}`);
    assertApprox(scen[i]!.totalMonthlyOutflow, base[i]!.totalMonthlyOutflow, 0.01, `outflow parity yearIndex=${i}`);
  }
}

function testNonDestructiveBonusMerge() {
  const plan = mkPlan();
  const years = plan.endAge - plan.startAge + 1;
  const yearInputs: YearInputs[] = Array.from({ length: years }, (_, yearIndex) => ({
    yearIndex,
    user: yearIndex === 1 ? { baseAnnual: 250_000 } : undefined, // bonusAnnual omitted intentionally
  }));
  const base = simulatePlan(plan);
  const scen = simulatePlan(plan, { yearInputs });

  const expectedBonusYear1 = 20_000 * Math.pow(1.05, 1);
  assertApprox(
    scen[1]!.grossIncome,
    250_000 + expectedBonusYear1,
    0.02,
    "bonus should remain baseline when bonusAnnual is undefined",
  );
  assertApprox(scen[0]!.grossIncome, base[0]!.grossIncome, 0.01, "year 0 should match baseline");
}

function testOpenEndedSetAnchorsAndRegrows() {
  const plan = mkPlan();
  const setAge = 32; // yearIndex 2
  const yi = buildScenarioYearInputsFromOverrides(plan, [
    { target: "income.user.base", kind: "set", fromAge: setAge, value: 200_000 },
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });

  // bonus remains baseline series
  const bonusY2 = 20_000 * Math.pow(1.05, 2);
  const bonusY3 = 20_000 * Math.pow(1.05, 3);

  // base regrows from anchor
  assertApprox(rows[2]!.grossIncome, 200_000 + bonusY2, 0.02, "yearIndex 2 uses anchored base + baseline bonus");
  assertApprox(rows[3]!.grossIncome, 210_000 + bonusY3, 0.03, "yearIndex 3 regrows base + baseline bonus");
}

function testRangedAddAndMult() {
  const plan = mkPlan();
  const yi = buildScenarioYearInputsFromOverrides(plan, [
    { target: "spend.lifestyle", kind: "add", fromAge: 31, toAge: 32, value: 500 }, // +$500/mo
    { target: "income.user.base", kind: "mult", fromAge: 32, toAge: 33, value: 1.1 }, // +10% for ages 32-33
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });
  const base = simulatePlan(plan);

  // Lifestyle outflow bump only for years 31-32 => yearIndex 1-2
  assertApprox(rows[0]!.lifestyleMonthly, base[0]!.lifestyleMonthly, 0.01, "yearIndex 0 lifestyle unchanged");
  assertApprox(rows[1]!.lifestyleMonthly, base[1]!.lifestyleMonthly + 500, 0.01, "yearIndex 1 lifestyle +500");
  assertApprox(rows[2]!.lifestyleMonthly, base[2]!.lifestyleMonthly + 500, 0.01, "yearIndex 2 lifestyle +500");
  assertApprox(rows[3]!.lifestyleMonthly, base[3]!.lifestyleMonthly, 0.01, "yearIndex 3 lifestyle unchanged");
}

function testRangedSetRejected() {
  const plan = mkPlan();
  const specs = deriveRuleSpecInputsFromPlanState(plan);
  const invalidOverride: unknown = { kind: "set", fromAge: 31, toAge: 32, value: 123 };
  const bad = {
    ...specs.income.user.base,
    overrides: [
      // Bypass types on purpose; must throw at runtime.
      invalidOverride as Override,
    ],
  };
  let threw = false;
  try {
    buildSeries(bad, specs.timeline);
  } catch {
    threw = true;
  }
  assert(threw, "ranged set must throw");
}

function main() {
  testBaselineParityViaYearInputs();
  testNonDestructiveBonusMerge();
  testOpenEndedSetAnchorsAndRegrows();
  testRangedAddAndMult();
  testRangedSetRejected();
  console.log("ruleSpec assertions: OK");
}

main();


import { simulatePlan } from "../src/engine/simulatePlan";
import type { PlanState, YearInputs } from "../src/engine/types/planState";
import {
  buildScenarioYearInputsFromOverrides,
  buildSeries,
  deriveRuleSpecInputsFromPlanState,
} from "../src/rulespec/index";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertApprox(actual: number, expected: number, eps: number, message: string) {
  const ok = Math.abs(actual - expected) <= eps;
  assert(ok, `${message}. expected=${expected} actual=${actual} diff=${actual - expected}`);
}

function mkPlan(overrides?: { endAge?: number; hasBonus?: boolean }): PlanState {
  const endAge = overrides?.endAge ?? 33;
  const hasBonus = overrides?.hasBonus ?? true;
  return {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge,
    household: {
      user: {
        age: 30,
        income: {
          baseAnnual: 100_000,
          hasBonus,
          bonusAnnual: hasBonus ? 20_000 : undefined,
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
    { target: "spend.lifestyle", kind: "add", fromAge: 31, toAge: 32, value: 500 }, // +$500/mo from 31, compounds (no revert)
    { target: "income.user.base", kind: "mult", fromAge: 32, toAge: 33, value: 1.1 }, // +10% at 32, compounds (no revert)
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });
  const base = simulatePlan(plan);

  // Lifestyle: add 500 at 31, then compound forward (growth 0 => flat 3500)
  assertApprox(rows[0]!.lifestyleMonthly, base[0]!.lifestyleMonthly, 0.01, "yearIndex 0 lifestyle unchanged");
  assertApprox(rows[1]!.lifestyleMonthly, base[1]!.lifestyleMonthly + 500, 0.01, "yearIndex 1 lifestyle +500");
  assertApprox(rows[2]!.lifestyleMonthly, 3500, 0.01, "yearIndex 2 compounds from 3500 (flat)");
  assertApprox(rows[3]!.lifestyleMonthly, 3500, 0.01, "yearIndex 3 continues from anchor (no revert)");
}

function testSalaryDropPermanently() {
  const plan = mkPlan({ endAge: 38 });
  const yi = buildScenarioYearInputsFromOverrides(plan, [
    { target: "income.user.base", kind: "set", fromAge: 33, value: 60_000 },
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });
  const bonusY3 = 20_000 * Math.pow(1.05, 3);
  const bonusY4 = 20_000 * Math.pow(1.05, 4);
  assertApprox(rows[3]!.grossIncome, 60_000 + bonusY3, 0.02, "yearIndex 3 (age 33) anchor 60k + bonus");
  assertApprox(rows[4]!.grossIncome, 60_000 * 1.05 + bonusY4, 0.02, "yearIndex 4 regrows from anchor at 5%");
}

function testRaiseInThreeYearsPermanently() {
  const plan = mkPlan({ endAge: 38 });
  const yi = buildScenarioYearInputsFromOverrides(plan, [
    { target: "income.user.base", kind: "set", fromAge: 33, value: 150_000 },
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });
  const bonusY3 = 20_000 * Math.pow(1.05, 3);
  const bonusY4 = 20_000 * Math.pow(1.05, 4);
  assertApprox(rows[3]!.grossIncome, 150_000 + bonusY3, 0.02, "yearIndex 3 (age 33) anchor 150k + bonus");
  assertApprox(rows[4]!.grossIncome, 150_000 * 1.05 + bonusY4, 0.02, "yearIndex 4 regrows from anchor at 5%");
}

function testGrowthFourPercentThenTwoPercent() {
  const plan = mkPlan({ endAge: 45 });
  const yi = buildScenarioYearInputsFromOverrides(plan, [
    { target: "income.user.base.growthPct", kind: "set", fromAge: 33, value: 0.04 },
    { target: "income.user.base.growthPct", kind: "set", fromAge: 40, value: 0.02 },
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });
  const base = simulatePlan(plan);
  assertApprox(rows[2]!.grossIncome, base[2]!.grossIncome, 0.02, "yearIndex 2 still baseline 5%");
  const baseAt33 = 100_000 * Math.pow(1.05, 2) * 1.04;
  const baseAt34 = baseAt33 * 1.04;
  const baseAt40 = 100_000 * Math.pow(1.05, 2) * Math.pow(1.04, 7) * 1.02;
  const baseAt41 = baseAt40 * 1.02;
  const bonus = (y: number) => 20_000 * Math.pow(1.05, y);
  assertApprox(rows[3]!.grossIncome, baseAt33 + bonus(3), 0.02, "yearIndex 3 first year at 4%");
  assertApprox(rows[4]!.grossIncome, baseAt34 + bonus(4), 0.02, "yearIndex 4 grows at 4%");
  assertApprox(rows[10]!.grossIncome, baseAt40 + bonus(10), 0.02, "yearIndex 10 (age 40) last year at 4%");
  assertApprox(rows[11]!.grossIncome, baseAt41 + bonus(11), 0.02, "yearIndex 11 grows at 2%");
}

function testIncomeCapEnforcesCeiling() {
  const plan = mkPlan({ endAge: 40, hasBonus: false }); // grossIncome = base only when no bonus
  const cap = 120_000;

  const yi = buildScenarioYearInputsFromOverrides(plan, [
    {
      target: "income.user.base",
      kind: "cap",
      fromAge: plan.startAge,
      value: cap,
    },
  ]);

  const rows = simulatePlan(plan, { yearInputs: yi });

  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.grossIncome > cap + 1) {
      throw new Error("Income cap violated at yearIndex " + i);
    }
  }
}

function testMultThenSetCollision() {
  const plan = mkPlan({ endAge: 38 });
  const yi = buildScenarioYearInputsFromOverrides(plan, [
    { target: "income.user.base", kind: "mult", fromAge: 32, value: 1.2 },
    { target: "income.user.base", kind: "set", fromAge: 33, value: 130_000 },
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });
  const baseAt32 = 100_000 * Math.pow(1.05, 2);
  const bonusY2 = 20_000 * Math.pow(1.05, 2);
  const bonusY3 = 20_000 * Math.pow(1.05, 3);
  assertApprox(rows[2]!.grossIncome, baseAt32 * 1.2 + bonusY2, 0.02, "yearIndex 2 mult applied, then regrows");
  assertApprox(rows[3]!.grossIncome, 130_000 + bonusY3, 0.02, "yearIndex 3 set overrides anchor 130k");
  assertApprox(rows[4]!.grossIncome, 130_000 * 1.05 + 20_000 * Math.pow(1.05, 4), 0.02, "yearIndex 4 regrows from set anchor");
}

function testRangedSetThenCompoundForward() {
  const plan = mkPlan();
  // Ranged set: anchor at 31, value 80k; applies only at 31, then we compound through 32 and beyond (no revert).
  const yi = buildScenarioYearInputsFromOverrides(plan, [
    { target: "income.user.base", kind: "set", fromAge: 31, toAge: 32, value: 80_000 },
  ]);
  const rows = simulatePlan(plan, { yearInputs: yi });
  const bonusY1 = 20_000 * 1.05;
  const bonusY2 = 20_000 * 1.05 * 1.05;
  const bonusY3 = 20_000 * Math.pow(1.05, 3);
  assertApprox(rows[1]!.grossIncome, 80_000 + bonusY1, 0.02, "yearIndex 1 anchor 80k + bonus");
  assertApprox(rows[2]!.grossIncome, 80_000 * 1.05 + bonusY2, 0.02, "yearIndex 2 regrows within range");
  assertApprox(rows[3]!.grossIncome, 80_000 * 1.05 * 1.05 + bonusY3, 0.02, "yearIndex 3 compounds from range end (anchor+growth)");
}

function main() {
  testBaselineParityViaYearInputs();
  testNonDestructiveBonusMerge();
  testOpenEndedSetAnchorsAndRegrows();
  testRangedAddAndMult();
  testRangedSetThenCompoundForward();
  testSalaryDropPermanently();
  testRaiseInThreeYearsPermanently();
  testGrowthFourPercentThenTwoPercent();
  testMultThenSetCollision();
  testIncomeCapEnforcesCeiling();
  console.log("ruleSpec assertions: OK");
}

main();


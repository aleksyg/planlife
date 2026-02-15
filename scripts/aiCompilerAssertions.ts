import { computeConfirmationsRequired, isPartnerPatch } from "../src/ai/compiler/confirmations";
import { getLastUserText, promptMentionsPartner } from "../src/ai/compiler/promptFacts";
import { firstYearIndexMeetingThreshold, inferThresholdTriggerFromText } from "../src/ai/compiler/thresholdTriggers";
import type { AiPromptPayload } from "../src/ai/promptPayload";
import type { AiChatMessage } from "../src/ai/types";
import { applyScenarioPatches } from "../src/scenario/applyPatches";
import { materializeYearInputs } from "../src/scenario/materializeYearInputs";
import type { ScenarioPatch } from "../src/scenario/types";
import type { PlanState } from "../src/engine/types/planState";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function mkCtx(maxYearIndex: number): AiPromptPayload {
  return {
    allowedMutations: {
      yearIndex: { min: 0, max: maxYearIndex },
      dollars: { min: 0, max: 100_000_000 },
      monthlyDollars: { min: 0, max: 10_000_000 },
      rate: { min: 0, max: 1 },
      pct: { min: 0, max: 100 },
      growthRate: { min: 0, max: 0.2 },
    },
    currentValues: {
      hasPartner: true,
      startAge: 30,
      endAge: 60,
      user: {
        baseAnnual: 200_000,
        incomeGrowthRate: 0.03,
        preTaxDeductionsMonthly: 0,
        retirement: {
          hasPlan: true,
          preTaxPct: 5,
          rothPct: 5,
          hasEmployerMatch: true,
          employerMatchPct: 50,
          employerMatchUpToPct: 6,
        },
      },
      partner: {
        baseAnnual: 150_000,
        incomeGrowthRate: 0.03,
        preTaxDeductionsMonthly: 0,
        retirement: {
          hasPlan: true,
          preTaxPct: 5,
          rothPct: 5,
          hasEmployerMatch: true,
          employerMatchPct: 50,
          employerMatchUpToPct: 6,
        },
      },
      lifestyleMonthly: 5_000,
      housingMonthlyRent: 3_000,
      stateTaxRate: 0.05,
    },
    baselineSummary: {
      keyMetrics: {
        finalAge: 60,
        finalNetWorth: 1_000_000,
        finalAssets: 1_100_000,
        finalDebt: 100_000,
        year0TaxesTotal: 0,
        year0TaxesFederal: 0,
        year0TaxesState: 0,
        year0TaxesFica: 0,
      },
      whyNotes: [],
    },
    enabledOverrides: [],
    series: {
      grossIncomeByYear: [350_000],
      brokerageByYear: [500_000],
      netWorthByYear: [800_000],
      userBaseByYear: [200_000],
      userBonusByYear: [0],
      partnerBaseByYear: [150_000],
      partnerBonusByYear: [0],
      baselineUserBaseByYear: [200_000],
      baselineUserBonusByYear: [0],
    },
  };
}

function testPromptFacts() {
  assert(promptMentionsPartner("my wife stops working"), "should detect partner reference");
  assert(!promptMentionsPartner("I stop working"), "should not detect partner reference");

  const messages: AiChatMessage[] = [
    { role: "assistant", content: "hi" },
    { role: "user", content: "first" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "second" },
  ];
  assert(getLastUserText(messages) === "second", "should return last user text");
}

function testPartnerConfirmations() {
  const ctx = mkCtx(40);
  const patches: ScenarioPatch[] = [
    { type: "SetIncomeRange", who: "partner", startYearIndex: 3, endYearIndexInclusive: 40, baseAnnual: 0 },
  ];
  assert(isPartnerPatch(patches[0]!), "should classify partner patch");

  const conf = computeConfirmationsRequired(patches, ctx);
  assert(conf.some((x) => x.toLowerCase().includes("partner")), "should require partner confirmation");
  assert(
    conf.some((x) => x.toLowerCase().includes("income") && x.includes("$0")),
    "should require income-to-zero confirmation",
  );
}

function testUserIncomeZeroConfirmations() {
  const ctx = mkCtx(10);
  const patches: ScenarioPatch[] = [
    { type: "SetIncomeRange", who: "user", startYearIndex: 1, endYearIndexInclusive: 3, baseAnnual: 0 },
  ];
  const conf = computeConfirmationsRequired(patches, ctx);
  assert(conf.length > 0, "should require confirmation when income is set to zero for >=1 year");
}

function mkPlan(): PlanState {
  return {
    asOfYearMonth: "2026-02",
    startAge: 30,
    endAge: 32,
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
      housing: { status: "rent", monthlyRent: 2_000 },
    },
    expenses: { mode: "total", lifestyleMonthly: 3_000 },
    debt: [],
    balanceSheet: { assets: [], home: { owner: "joint", currentValue: 0 } },
    assumptions: { inflationRate: 0, returnRate: 0.07, cashRate: 0.04, flatTaxRate: 0.3, stateTaxRate: 0.05 },
  };
}

function testMaterializePrecedence() {
  const plan = mkPlan();
  const patches: ScenarioPatch[] = [
    { type: "SetIncomeRange", who: "user", startYearIndex: 0, endYearIndexInclusive: 2, baseAnnual: 100_000 },
    { type: "SetIncomeRange", who: "user", startYearIndex: 1, endYearIndexInclusive: 1, baseAnnual: 250_000 }, // more specific
    { type: "SetIncomeRange", who: "user", startYearIndex: 1, endYearIndexInclusive: 1, baseAnnual: 300_000 }, // tie, later wins
  ];
  const overrides = applyScenarioPatches({}, patches);
  const yi = materializeYearInputs(plan, overrides);
  assert(yi[0]?.user?.baseAnnual === 100_000, "year 0 should use broad segment");
  assert(yi[1]?.user?.baseAnnual === 300_000, "year 1 should use most specific + last-wins tie");
  assert(yi[2]?.user?.baseAnnual === 100_000, "year 2 should use broad segment");
}

function testThresholdTriggerParsingAndMapping() {
  const trig = inferThresholdTriggerFromText("buy a $140k car once investments hit $1m");
  assert(trig?.seriesKey === "brokerageByYear", "investments should map to brokerage series");
  assert(trig?.threshold === 1_000_000, "should parse $1m");
  const idx = firstYearIndexMeetingThreshold([200_000, 900_000, 1_000_000, 1_100_000], 1_000_000);
  assert(idx === 2, "should map to first year meeting threshold");
}

function main() {
  testPromptFacts();
  testPartnerConfirmations();
  testUserIncomeZeroConfirmations();
  testMaterializePrecedence();
  testThresholdTriggerParsingAndMapping();
  console.log("aiCompilerAssertions: OK");
}

main();


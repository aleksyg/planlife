import { deriveIncomeIntent } from "../src/ai/compiler/incomeIntent";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  // A1: bonus-only — no base or total comp
  assert(deriveIncomeIntent("I'll make $500k bonus next year") === "BONUS_ONLY", "500k bonus next year => BONUS_ONLY");
  assert(deriveIncomeIntent("set my bonus to 400k") === "BONUS_ONLY", "bonus to 400k => BONUS_ONLY");
  assert(deriveIncomeIntent("bonus will be 300k starting next year") === "BONUS_ONLY", "bonus 300k => BONUS_ONLY");

  // A2: total-comp-only
  assert(deriveIncomeIntent("Total comp next year will be $900k") === "TOTAL_COMP_ONLY", "total comp 900k => TOTAL_COMP_ONLY");
  assert(deriveIncomeIntent("I'll make 900k next year") === "TOTAL_COMP_ONLY", "make 900k next year => TOTAL_COMP_ONLY");
  assert(deriveIncomeIntent("all-in comp to 800k") === "TOTAL_COMP_ONLY", "all-in 800k => TOTAL_COMP_ONLY");
  assert(deriveIncomeIntent("TC to 1M at age 35") === "TOTAL_COMP_ONLY", "TC to 1M => TOTAL_COMP_ONLY");

  // A3: bonus + total comp
  assert(
    deriveIncomeIntent("Total comp next year will be $900k and bonus will be $500k") === "BONUS_AND_TOTAL_COMP",
    "total comp + bonus => BONUS_AND_TOTAL_COMP",
  );

  // A4: base-only
  assert(deriveIncomeIntent("Set my base to $550k starting next year") === "BASE_ONLY", "base to 550k => BASE_ONLY");
  assert(deriveIncomeIntent("base salary 600k") === "BASE_ONLY", "base salary => BASE_ONLY");

  // Ambiguous
  assert(
    deriveIncomeIntent("cap my comp at 1M") === "AMBIGUOUS_CONFLICT",
    "cap comp => AMBIGUOUS_CONFLICT",
  );

  // NONE / non-income
  assert(deriveIncomeIntent("what if I take a year off?") === "NONE", "year off => NONE");
  assert(deriveIncomeIntent("increase lifestyle spend") === "NONE", "spend => NONE");

  console.log("incomeIntentAssertions: OK");
}

main();

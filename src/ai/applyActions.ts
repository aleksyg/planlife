import type { PlanState } from "@/engine";
import type { SimulatePlanOptions } from "@/engine";
import type { AiAction, Who } from "./types";

type ApplyResult = { plan: PlanState; options?: SimulatePlanOptions };

function clonePlan(plan: PlanState): PlanState {
  // PlanState is plain JSON; this keeps cloning simple and deterministic.
  return JSON.parse(JSON.stringify(plan)) as PlanState;
}

function getPerson(plan: PlanState, who: Who) {
  if (who === "user") return plan.household.user;
  if (!plan.household.hasPartner || !plan.household.partner) {
    throw new Error("Cannot apply partner action: baseline has no partner.");
  }
  return plan.household.partner;
}

export function applyAiActions(baseline: PlanState, actions: AiAction[]): ApplyResult {
  const plan = clonePlan(baseline);
  const options: SimulatePlanOptions = {};

  for (const action of actions) {
    switch (action.type) {
      case "QuitPartnerJobFromYearIndex": {
        options.partnerZeroIncomeFromYearIndex = action.yearIndex;
        break;
      }
      case "SetUserBaseAnnual": {
        plan.household.user.income.baseAnnual = action.value;
        break;
      }
      case "SetPartnerBaseAnnual": {
        if (plan.household.hasPartner && plan.household.partner) {
          plan.household.partner.income.baseAnnual = action.value;
        } else {
          throw new Error("Cannot set partner income: baseline has no partner.");
        }
        break;
      }
      case "SetIncomeGrowthRate": {
        getPerson(plan, action.who).income.incomeGrowthRate = action.value;
        break;
      }
      case "SetLifestyleMonthly": {
        // v1: force total mode for simplicity.
        plan.expenses = { mode: "total", lifestyleMonthly: action.value };
        break;
      }
      case "SetHousingMonthlyRent": {
        plan.household.housing = { status: "rent", monthlyRent: action.value };
        break;
      }
      case "SetStateTaxRate": {
        plan.assumptions.stateTaxRate = action.value;
        break;
      }
      case "SetRetirementSplitPct": {
        const person = getPerson(plan, action.who);
        person.income.retirement = person.income.retirement ?? { hasPlan: true };
        person.income.retirement.hasPlan = true;
        person.income.retirement.employeePreTaxContributionPct = action.preTaxPct;
        person.income.retirement.employeeRothContributionPct = action.rothPct;
        break;
      }
      case "SetEmployerMatch": {
        const person = getPerson(plan, action.who);
        person.income.retirement = person.income.retirement ?? { hasPlan: false };
        person.income.retirement.hasEmployerMatch = action.hasMatch;
        if (action.hasMatch) {
          person.income.retirement.employerMatchPct = action.matchPct ?? 0;
          person.income.retirement.employerMatchUpToPct = action.upToPct ?? 0;
        } else {
          person.income.retirement.employerMatchPct = 0;
          person.income.retirement.employerMatchUpToPct = 0;
        }
        break;
      }
      case "SetPreTaxDeductionsMonthly": {
        getPerson(plan, action.who).income.preTaxDeductionsMonthly = action.value;
        break;
      }
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  }

  const hasAnyOption = options.partnerZeroIncomeFromYearIndex !== undefined;
  return { plan, options: hasAnyOption ? options : undefined };
}


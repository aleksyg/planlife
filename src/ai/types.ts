export type Who = "user" | "partner";

export type AiScenarioPatch = import("@/scenario/types").ScenarioPatch;
export type TargetedOverride = import("@/rulespec/types").TargetedOverride;
export type TargetKey = import("@/rulespec/types").TargetKey;

export type AiAction =
  | { type: "QuitPartnerJobFromYearIndex"; yearIndex: number }
  | { type: "SetUserBaseAnnual"; value: number }
  | { type: "SetPartnerBaseAnnual"; value: number }
  | { type: "SetUserBaseAnnualFromYearIndex"; yearIndex: number; value: number }
  | { type: "SetPartnerBaseAnnualFromYearIndex"; yearIndex: number; value: number }
  | { type: "SetUserBaseAnnualForYearRange"; startYearIndex: number; endYearIndexInclusive: number; value: number }
  | { type: "SetPartnerBaseAnnualForYearRange"; startYearIndex: number; endYearIndexInclusive: number; value: number }
  | { type: "SetIncomeGrowthRate"; who: Who; value: number }
  | { type: "SetLifestyleMonthly"; value: number }
  | { type: "SetHousingMonthlyRent"; value: number }
  | { type: "SetHousingMonthlyRentFromYearIndex"; yearIndex: number; value: number }
  | { type: "SetStateTaxRate"; value: number }
  | { type: "SetRetirementSplitPct"; who: Who; preTaxPct: number; rothPct: number }
  | {
      type: "SetEmployerMatch";
      who: Who;
      hasMatch: boolean;
      matchPct?: number;
      upToPct?: number;
    }
  | { type: "SetPreTaxDeductionsMonthly"; who: Who; value: number };

export type AiPlannerMode = "clarify" | "propose";

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiPlannerResponse =
  | {
      mode: "clarify";
      questions: string[];
      assumptions?: string[];
    }
  | {
      mode: "propose";
      assumptions: string[];
      overrides: TargetedOverride[];
      /** Optional short plain-English scenario summary. */
      draftScenarioSummary?: string;
      /** If present and non-empty, UI must require checkboxes before enabling Apply. */
      confirmationsRequired?: string[];
      /** Optional hint for which year/age to focus preview on. */
      impactPreviewRequest?: { focusYearIndex?: number };
    };


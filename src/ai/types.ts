export type Who = "user" | "partner";

export type AiAction =
  | { type: "QuitPartnerJobFromYearIndex"; yearIndex: number }
  | { type: "SetUserBaseAnnual"; value: number }
  | { type: "SetPartnerBaseAnnual"; value: number }
  | { type: "SetIncomeGrowthRate"; who: Who; value: number }
  | { type: "SetLifestyleMonthly"; value: number }
  | { type: "SetHousingMonthlyRent"; value: number }
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

export type AiResponse = {
  actions: AiAction[];
  notes?: string[];
};


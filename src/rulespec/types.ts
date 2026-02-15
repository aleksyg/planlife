export type Timeline = {
  startAge: number;
  endAge: number;
  length: number; // = endAge - startAge + 1
};

export type GrowthRule =
  | { type: "pct"; annualPct: number } // 0..1 (e.g. 0.03)
  | { type: "flat"; annualAmount: number }; // dollars per year

export type Override =
  | { kind: "set"; fromAge: number; value: number; toAge?: number }
  | { kind: "add"; fromAge: number; value: number; toAge?: number }
  | { kind: "mult"; fromAge: number; value: number; toAge?: number }
  | { kind: "cap"; fromAge: number; value: number; toAge?: number };

/** Growth rate override: from this age onward use this rate (e.g. 0.04 for 4%). */
export type GrowthOverride = { fromAge: number; value: number };

export type TargetKey =
  | "income.user.base"
  | "income.user.bonus"
  | "income.partner.base"
  | "income.partner.bonus"
  | "income.user.base.growthPct"
  | "income.partner.base.growthPct"
  | "income.user.bonus.growthPct"
  | "income.partner.bonus.growthPct"
  | "spend.lifestyle"
  | "spend.housing";

export type TargetedOverride = Override & { target: TargetKey };

export type ComponentSpec = {
  startValue: number;
  growth: GrowthRule;
  overrides: Override[];
  /** First-class growth rate overrides (pct components only). value = decimal e.g. 0.04. */
  growthOverrides: GrowthOverride[];
};

export type RuleSpecInputs = {
  timeline: Timeline;
  partnerEnabled: boolean;

  income: {
    user: {
      base: ComponentSpec;
      bonus: ComponentSpec;
    };
    partner?: {
      base: ComponentSpec;
      bonus: ComponentSpec;
    };
  };

  spend: {
    lifestyleMonthly: ComponentSpec;
    housingMonthly: ComponentSpec;
  };
};


export type IncomeAppliesTo = "user" | "partner" | "both";

export type IncomeSetRangeMutation = {
  mutationId?: string;
  kind: "income_set_range";
  startAge: number;
  endAge: number | null; // null means through retirement
  baseAnnual: number | null; // null means unchanged
  bonusAnnual: number | null; // null means unchanged
  appliesTo?: IncomeAppliesTo; // default "user" if missing
};

export type IncomeGrowthRangeMutation = {
  mutationId?: string;
  kind: "income_growth_range";
  startAge: number;
  endAge: number | null;
  baseGrowthPct: number | null;
  bonusGrowthPct: number | null;
  appliesTo?: IncomeAppliesTo;
};

export type IncomeMilestoneMutation = {
  mutationId?: string;
  kind: "income_milestone";
  appliesTo?: IncomeAppliesTo;
  age: number;
  baseAnnual: number | null;
  bonusAnnual: number | null;
  growthPct: number | null;
};

export type OneTimeBonusMutation = {
  mutationId?: string;
  kind: "income_one_time_bonus";
  appliesTo?: IncomeAppliesTo;
  age: number;
  amount: number;
};

export type IncomeCapMutation = {
  mutationId?: string;
  kind: "income_cap_range";
  appliesTo?: IncomeAppliesTo;
  startAge: number;
  endAge: number | null;
  baseCapAnnual: number | null;
  bonusCapAnnual: number | null;
};

export type IncomeGrowthStepMutation = {
  mutationId?: string;
  kind: "income_growth_step";
  appliesTo?: IncomeAppliesTo;
  age: number;
  growthPct: number;
};

export type Mutation =
  | IncomeSetRangeMutation
  | IncomeGrowthRangeMutation
  | IncomeMilestoneMutation
  | OneTimeBonusMutation
  | IncomeCapMutation
  | IncomeGrowthStepMutation;

export type LifeEventTemplateKey = "grad_school";

export type LifeEvent = {
  id: string;
  title: string;
  enabled: boolean;
  summary: string[];
  mutations: Mutation[];
  templateKey?: LifeEventTemplateKey;
};

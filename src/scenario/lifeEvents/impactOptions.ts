export type IncomeImpactKind =
  | "income_set_range"
  | "income_milestone"
  | "income_one_time_bonus"
  | "income_cap_range"
  | "income_growth_step"
  | "income_401k_change";

export type IncomeImpactOption = {
  key: string;
  label: string;
  kind: IncomeImpactKind;
  enabled: boolean;
  description?: string;
};

export const incomeImpactOptions: IncomeImpactOption[] = [
  {
    key: "income_set_range",
    kind: "income_set_range",
    label: "Set income for a range of time",
    enabled: true,
  },
  {
    key: "income_milestone",
    kind: "income_milestone",
    label: "Income milestone (set at age)",
    enabled: true,
  },
  {
    key: "income_one_time_bonus",
    kind: "income_one_time_bonus",
    label: "One-time bonus",
    enabled: true,
  },
  {
    key: "income_growth_step",
    kind: "income_growth_step",
    label: "Income growth rate (from age)",
    enabled: true,
  },
  {
    key: "income_cap_range",
    kind: "income_cap_range",
    label: "Income cap (range)",
    enabled: true,
  },
  {
    key: "income_401k_change",
    kind: "income_401k_change",
    label: "401k contribution change",
    enabled: false,
    description: "Coming soon",
  },
];

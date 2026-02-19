import type { LifeEvent, Mutation, IncomeAppliesTo } from "./types";
import type { TargetedOverride } from "@/rulespec/types";

export type OverrideBuildOptions = {
  /** Clamp fromAge/toAge to this (inclusive). Omit to skip clamping. */
  minAge?: number;
  /** Clamp fromAge/toAge to this (inclusive). Omit to skip clamping. */
  maxAge?: number;
};

const GROWTH_PCT_TO_DECIMAL = 0.01;

function clampAge(age: number, opts: OverrideBuildOptions | undefined): number {
  if (opts == null) return age;
  let a = age;
  if (opts.minAge != null && Number.isFinite(opts.minAge)) a = Math.max(a, opts.minAge);
  if (opts.maxAge != null && Number.isFinite(opts.maxAge)) a = Math.min(a, opts.maxAge);
  return a;
}

function clampRange(
  from: number,
  to: number | null,
  opts: OverrideBuildOptions | undefined,
): { fromAge: number; toAge: number | undefined } {
  const fromAge = clampAge(from, opts);
  if (to == null) return { fromAge, toAge: undefined };
  const toAge = clampAge(to, opts);
  if (toAge < fromAge) return { fromAge, toAge: undefined };
  return { fromAge, toAge };
}

function targetsForAppliesTo(
  appliesTo: IncomeAppliesTo | undefined,
  baseOrBonus: "base" | "bonus",
): ("income.user.base" | "income.user.bonus" | "income.partner.base" | "income.partner.bonus")[] {
  const who = appliesTo ?? "user";
  const key = baseOrBonus === "base" ? "base" : "bonus";
  const userTarget = `income.user.${key}` as const;
  const partnerTarget = `income.partner.${key}` as const;
  if (who === "user") return [userTarget];
  if (who === "partner") return [partnerTarget];
  return [userTarget, partnerTarget];
}

function growthTargetsForAppliesTo(
  appliesTo: IncomeAppliesTo | undefined,
): (
  | "income.user.base.growthPct"
  | "income.user.bonus.growthPct"
  | "income.partner.base.growthPct"
  | "income.partner.bonus.growthPct"
)[] {
  const who = appliesTo ?? "user";
  if (who === "user") return ["income.user.base.growthPct", "income.user.bonus.growthPct"];
  if (who === "partner") return ["income.partner.base.growthPct", "income.partner.bonus.growthPct"];
  return [
    "income.user.base.growthPct",
    "income.user.bonus.growthPct",
    "income.partner.base.growthPct",
    "income.partner.bonus.growthPct",
  ];
}

function pushSet(
  out: TargetedOverride[],
  target: TargetedOverride["target"],
  fromAge: number,
  value: number,
  toAge?: number,
): void {
  out.push({ target, kind: "set", fromAge, value, ...(toAge != null ? { toAge } : {}) });
}

function pushAdd(
  out: TargetedOverride[],
  target: TargetedOverride["target"],
  fromAge: number,
  value: number,
  toAge?: number,
): void {
  out.push({ target, kind: "add", fromAge, value, ...(toAge != null ? { toAge } : {}) });
}

function pushCap(
  out: TargetedOverride[],
  target: TargetedOverride["target"],
  fromAge: number,
  value: number,
  toAge?: number,
): void {
  out.push({ target, kind: "cap", fromAge, value, ...(toAge != null ? { toAge } : {}) });
}

function mutationToOverrides(m: Mutation, opts: OverrideBuildOptions | undefined): TargetedOverride[] {
  const out: TargetedOverride[] = [];

  switch (m.kind) {
    case "income_set_range": {
      const { fromAge, toAge } = clampRange(m.startAge, m.endAge, opts);
      if (m.baseAnnual != null && Number.isFinite(m.baseAnnual)) {
        for (const t of targetsForAppliesTo(m.appliesTo, "base")) {
          pushSet(out, t, fromAge, Math.max(0, m.baseAnnual), toAge);
        }
      }
      if (m.bonusAnnual != null && Number.isFinite(m.bonusAnnual)) {
        for (const t of targetsForAppliesTo(m.appliesTo, "bonus")) {
          pushSet(out, t, fromAge, Math.max(0, m.bonusAnnual), toAge);
        }
      }
      break;
    }

    case "income_one_time_bonus": {
      const age = clampAge(m.age, opts);
      const amt = Number.isFinite(m.amount) ? m.amount : 0;
      for (const t of targetsForAppliesTo(m.appliesTo, "bonus")) {
        pushAdd(out, t, age, amt, age);
      }
      break;
    }

    case "income_cap_range": {
      const { fromAge, toAge } = clampRange(m.startAge, m.endAge, opts);
      if (m.baseCapAnnual != null && Number.isFinite(m.baseCapAnnual)) {
        for (const t of targetsForAppliesTo(m.appliesTo, "base")) {
          pushCap(out, t, fromAge, Math.max(0, m.baseCapAnnual), toAge);
        }
      }
      if (m.bonusCapAnnual != null && Number.isFinite(m.bonusCapAnnual)) {
        for (const t of targetsForAppliesTo(m.appliesTo, "bonus")) {
          pushCap(out, t, fromAge, Math.max(0, m.bonusCapAnnual), toAge);
        }
      }
      break;
    }

    case "income_growth_step": {
      const fromAge = clampAge(m.age, opts);
      const value = Number.isFinite(m.growthPct) ? m.growthPct * GROWTH_PCT_TO_DECIMAL : 0;
      for (const t of growthTargetsForAppliesTo(m.appliesTo)) {
        pushSet(out, t, fromAge, value, undefined);
      }
      break;
    }

    case "income_milestone": {
      const age = clampAge(m.age, opts);
      if (m.baseAnnual != null && Number.isFinite(m.baseAnnual)) {
        for (const t of targetsForAppliesTo(m.appliesTo, "base")) {
          pushSet(out, t, age, Math.max(0, m.baseAnnual), undefined);
        }
      }
      if (m.bonusAnnual != null && Number.isFinite(m.bonusAnnual)) {
        for (const t of targetsForAppliesTo(m.appliesTo, "bonus")) {
          pushSet(out, t, age, Math.max(0, m.bonusAnnual), undefined);
        }
      }
      if (m.growthPct != null && Number.isFinite(m.growthPct)) {
        const value = m.growthPct * GROWTH_PCT_TO_DECIMAL;
        for (const t of growthTargetsForAppliesTo(m.appliesTo)) {
          pushSet(out, t, age, value, undefined);
        }
      }
      break;
    }

    case "income_growth_range": {
      // Engine only supports "from age onward" growth overrides. Approximate by
      // setting a growth step at startAge; endAge is ignored for growth in this implementation.
      const fromAge = clampAge(m.startAge, opts);
      if (m.baseGrowthPct != null && Number.isFinite(m.baseGrowthPct)) {
        const value = m.baseGrowthPct * GROWTH_PCT_TO_DECIMAL;
        for (const t of growthTargetsForAppliesTo(m.appliesTo)) {
          if (t.includes(".base.")) pushSet(out, t, fromAge, value, undefined);
        }
      }
      if (m.bonusGrowthPct != null && Number.isFinite(m.bonusGrowthPct)) {
        const value = m.bonusGrowthPct * GROWTH_PCT_TO_DECIMAL;
        for (const t of growthTargetsForAppliesTo(m.appliesTo)) {
          if (t.includes(".bonus.")) pushSet(out, t, fromAge, value, undefined);
        }
      }
      break;
    }

    default:
      break;
  }

  return out;
}

/**
 * Build TargetedOverride[] from a life event. Use options to clamp ages to plan horizon.
 */
export function buildOverridesFromLifeEvent(
  evt: LifeEvent,
  options?: OverrideBuildOptions,
): TargetedOverride[] {
  const mutations = evt.mutations ?? [];
  const opts = options;
  const out: TargetedOverride[] = [];
  for (const m of mutations) {
    out.push(...mutationToOverrides(m, opts));
  }
  return out;
}

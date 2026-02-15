/**
 * TOTAL_COMP_CONSTRAINT: multi-year total comp targets and/or a cap.
 * Resolved deterministically into base/bonus overrides; caps enforced as hard ceilings.
 */
import type { AiPromptPayload } from "@/ai/promptPayload";
import type { TargetedOverride } from "@/ai/types";

export type ResolutionPolicy = "BASE_ONLY" | "BONUS_ONLY" | "PROPORTIONAL" | "ASK";

export type TotalCompConstraint = {
  person: "user" | "partner";
  milestones: { age: number; value: number }[];
  cap?: { value: number; startAge: number };
  resolutionPolicy?: ResolutionPolicy;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Build target total comp by year from milestones (interpolate between, extend last) then apply cap as ceiling.
 */
function buildTargetTotalPath(
  startAge: number,
  endAge: number,
  milestones: { age: number; value: number }[],
  cap: { value: number; startAge: number } | undefined,
): number[] {
  const len = endAge - startAge + 1;
  const path: number[] = [];
  const sorted = [...milestones].filter((m) => m.age >= startAge && m.age <= endAge).sort((a, b) => a.age - b.age);

  for (let i = 0; i < len; i++) {
    const age = startAge + i;
    let value: number;
    if (sorted.length === 0) value = 0;
    else if (sorted.length === 1) value = sorted[0]!.value;
    else {
      const before = sorted.filter((m) => m.age <= age);
      const after = sorted.filter((m) => m.age > age);
      if (before.length === 0) value = after[0]!.value;
      else if (after.length === 0) value = before[before.length - 1]!.value;
      else {
        const a = before[before.length - 1]!;
        const b = after[0]!;
        const t = (age - a.age) / (b.age - a.age);
        value = a.value + t * (b.value - a.value);
      }
    }
    if (cap && age >= cap.startAge) value = Math.min(value, cap.value);
    path.push(Math.max(0, value));
  }
  return path;
}

/** Collapse a per-year series into ranges (fromAge, toAge, value) for set overrides. */
function seriesToRanges(
  startAge: number,
  series: number[],
): { fromAge: number; toAge: number; value: number }[] {
  const ranges: { fromAge: number; toAge: number; value: number }[] = [];
  let i = 0;
  while (i < series.length) {
    const v = series[i]!;
    let j = i + 1;
    while (j < series.length && Math.abs(series[j]! - v) < 1) j++;
    const fromAge = startAge + i;
    const toAge = startAge + j - 1;
    ranges.push({ fromAge, toAge, value: Math.round(v) });
    i = j;
  }
  return ranges;
}

export type MaterializeResult = {
  overrides: TargetedOverride[];
  assumptions: string[];
  error?: string;
};

/**
 * Resolve TOTAL_COMP_CONSTRAINT into base (and optionally bonus) overrides.
 * Cap is enforced as a hard ceiling: for years >= cap.startAge, totalComp = min(derived, cap.value).
 */
export function materializeTotalCompConstraint(
  ctx: AiPromptPayload,
  constraint: TotalCompConstraint,
): MaterializeResult {
  const { person, milestones, cap, resolutionPolicy } = constraint;
  const startAge = ctx.currentValues.startAge;
  const endAge = ctx.currentValues.endAge;
  const baseByYear = person === "user" ? ctx.series.userBaseByYear : ctx.series.partnerBaseByYear;
  const bonusByYear = person === "user" ? ctx.series.userBonusByYear : ctx.series.partnerBonusByYear;

  if (!resolutionPolicy || resolutionPolicy === "ASK") {
    return {
      overrides: [],
      assumptions: [],
      error: "To hit these total comp targets, should I adjust base only, bonus only, or both proportionally?",
    };
  }

  if (person === "partner" && !ctx.currentValues.hasPartner) {
    return { overrides: [], assumptions: ["Partner total comp constraint ignored (no partner in plan)."], error: "No partner." };
  }

  const targetPath = buildTargetTotalPath(startAge, endAge, milestones, cap);
  const overrides: TargetedOverride[] = [];
  const assumptions: string[] = [];

  const baseKey = person === "user" ? ("income.user.base" as const) : ("income.partner.base" as const);
  const bonusKey = person === "user" ? ("income.user.bonus" as const) : ("income.partner.bonus" as const);

  if (resolutionPolicy === "BASE_ONLY") {
    const baseSeries = targetPath.map((total, i) => {
      const bonus = bonusByYear[i] ?? 0;
      return Math.max(0, total - bonus);
    });
    const ranges = seriesToRanges(startAge, baseSeries);
    for (const r of ranges) {
      overrides.push({
        target: baseKey,
        kind: "set",
        fromAge: r.fromAge,
        toAge: r.toAge,
        value: r.value,
      });
    }
    assumptions.push(
      `Total comp targets (${milestones.map((m) => `${m.age}: ${fmt(m.value)}`).join(", ")}) resolved by adjusting base only; bonus follows current path.`,
    );
    if (cap) {
      assumptions.push(`Cap ${fmt(cap.value)} at age ${cap.startAge}+ enforced as ceiling; no growth above cap.`);
    }
  } else if (resolutionPolicy === "BONUS_ONLY") {
    const bonusSeries = targetPath.map((total, i) => {
      const base = baseByYear[i] ?? 0;
      return Math.max(0, total - base);
    });
    const ranges = seriesToRanges(startAge, bonusSeries);
    for (const r of ranges) {
      overrides.push({
        target: bonusKey,
        kind: "set",
        fromAge: r.fromAge,
        toAge: r.toAge,
        value: r.value,
      });
    }
    assumptions.push(
      `Total comp targets resolved by adjusting bonus only; base follows current path.`,
    );
    if (cap) {
      assumptions.push(`Cap ${fmt(cap.value)} at age ${cap.startAge}+ enforced as ceiling.`);
    }
  } else if (resolutionPolicy === "PROPORTIONAL") {
    const baseSeries = baseByYear.slice(0, targetPath.length);
    const bonusSeries = bonusByYear.slice(0, targetPath.length);
    const resolvedBase: number[] = [];
    const resolvedBonus: number[] = [];
    for (let i = 0; i < targetPath.length; i++) {
      const total = targetPath[i]!;
      const b = baseSeries[i] ?? 0;
      const bo = bonusSeries[i] ?? 0;
      const sum = b + bo;
      if (sum <= 0) {
        resolvedBase.push(total / 2);
        resolvedBonus.push(total / 2);
      } else {
        const ratio = total / sum;
        resolvedBase.push(Math.max(0, b * ratio));
        resolvedBonus.push(Math.max(0, bo * ratio));
      }
    }
    const baseRanges = seriesToRanges(startAge, resolvedBase);
    const bonusRanges = seriesToRanges(startAge, resolvedBonus);
    for (const r of baseRanges) {
      overrides.push({ target: baseKey, kind: "set", fromAge: r.fromAge, toAge: r.toAge, value: r.value });
    }
    for (const r of bonusRanges) {
      overrides.push({ target: bonusKey, kind: "set", fromAge: r.fromAge, toAge: r.toAge, value: r.value });
    }
    assumptions.push(`Total comp targets resolved by scaling base and bonus proportionally.`);
    if (cap) {
      assumptions.push(`Cap ${fmt(cap.value)} at age ${cap.startAge}+ enforced as ceiling.`);
    }
  } else {
    return { overrides: [], assumptions: [], error: "Unknown resolution policy." };
  }

  return { overrides, assumptions };
}

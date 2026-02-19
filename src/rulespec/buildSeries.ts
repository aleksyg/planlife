import type { ComponentSpec, Override, Timeline } from "./types";
import { yearIndexFromAge } from "./timeline";

function assertFinite(n: number, msg: string) {
  if (!Number.isFinite(n)) throw new Error(msg);
}

/**
 * Active growth rate at each index (carried-forward array with point overrides).
 * For pct: from growthOverrides (last applicable) or spec.growth.annualPct.
 * Invariant: Growth overrides replace baseline growth; they do not add to it.
 */
function buildGrowthByIndex(spec: ComponentSpec, tl: Timeline): number[] {
  return Array.from({ length: tl.length }, (_, idx) => {
    const age = tl.startAge + idx;
    let rate = spec.growth.type === "pct" ? spec.growth.annualPct : 0;
    const sorted = [...(spec.growthOverrides ?? [])].sort((a, b) => a.fromAge - b.fromAge);
    for (const go of sorted) {
      if (go.fromAge <= age) rate = go.value;
    }
    return rate;
  });
}

type OrderedOverride = { op: Override; idx: number };

function orderOverrides(ops: readonly Override[]): Override[] {
  const withIdx: OrderedOverride[] = ops.map((op, idx) => ({ op, idx }));
  withIdx.sort((a, b) => {
    if (a.op.fromAge !== b.op.fromAge) return a.op.fromAge - b.op.fromAge;
    const aTo = a.op.kind === "set" ? a.op.toAge : a.op.toAge;
    const bTo = b.op.kind === "set" ? b.op.toAge : b.op.toAge;
    if (aTo == null && bTo != null) return 1;
    if (aTo != null && bTo == null) return -1;
    if (aTo != null && bTo != null && aTo !== bTo) return aTo - bTo;
    return a.idx - b.idx;
  });
  return withIdx.map((x) => x.op);
}

function overrideAppliesAt(op: Override, index: number, tl: Timeline): boolean {
  const fromIdx = yearIndexFromAge(tl, op.fromAge);

  if (op.kind === "set" || op.kind === "add" || op.kind === "mult") {
    return index === fromIdx;
  }

  const toIdx = op.toAge != null ? yearIndexFromAge(tl, op.toAge) : null;
  if (toIdx != null) return index >= fromIdx && index <= toIdx;
  return index >= fromIdx;
}

function applyOverrideAt(op: Override, value: number, _tl: Timeline): number {
  assertFinite(op.value, "Override value must be finite.");
  if (op.kind === "set") {
    if (op.value < 0) throw new Error("Set override value must be >= 0.");
    return op.value;
  }
  if (op.kind === "add") {
    const next = value + op.value;
    if (next < 0) throw new Error("Add override resulted in negative value.");
    return next;
  }
  if (op.kind === "mult") {
    if (op.value <= 0) throw new Error("Mult override value must be > 0.");
    const next = value * op.value;
    if (next < 0) throw new Error("Mult override resulted in negative value.");
    return next;
  }
  if (op.kind === "cap") {
    return Math.min(value, op.value);
  }
  const _: never = op;
  return _;
}

/** When true, `add` overrides affect only that year's output and are NOT carried forward for growth. */
export type BuildSeriesOptions = { addOverridesNonRecurring?: boolean };

/**
 * Build series in a single forward pass: year i depends only on value[i-1] and growth[i],
 * then applies income overrides at i; next year compounds from the overridden value.
 * Eliminates snapback and flat-forever bugs (no save/restore or regrow patches).
 *
 * When addOverridesNonRecurring is true (e.g. for bonus): recurring value is built from
 * set/cap/mult only and carries forward; add overrides are summed per year and added to
 * output only (bonusTotalAnnual = bonusRecurringAnnual + bonusAddAnnual). Sanity: add
 * never compounds into future years.
 */
export function buildSeries(
  spec: ComponentSpec,
  tl: Timeline,
  options?: BuildSeriesOptions,
): number[] {
  assertFinite(spec.startValue, "startValue must be finite.");
  if (spec.growth.type === "pct") assertFinite(spec.growth.annualPct, "annualPct must be finite.");
  else assertFinite(spec.growth.annualAmount, "annualAmount must be finite.");

  const addNonRecurring = options?.addOverridesNonRecurring === true;
  const allOverrides = orderOverrides(spec.overrides);
  const recurringOps = addNonRecurring ? allOverrides.filter((op) => op.kind !== "add") : allOverrides;
  const addOps = addNonRecurring ? allOverrides.filter((op): op is Override & { kind: "add" } => op.kind === "add") : [];

  const growth = buildGrowthByIndex(spec, tl);

  const out: number[] = [spec.startValue];
  // Index 0: apply only recurring overrides (set/cap/mult)
  let v0 = out[0]!;
  for (const op of recurringOps) {
    if (overrideAppliesAt(op, 0, tl)) {
      v0 = applyOverrideAt(op, v0, tl);
    }
  }
  let addSum0 = 0;
  for (const op of addOps) {
    if (overrideAppliesAt(op, 0, tl)) {
      assertFinite(op.value, "Add override value must be finite.");
      addSum0 += op.value;
    }
  }
  out[0] = v0 + addSum0;

  for (let i = 1; i < tl.length; i++) {
    const prevRecurring = addNonRecurring ? v0 : out[i - 1]!;
    let v: number;
    if (spec.growth.type === "pct") {
      v = prevRecurring * (1 + growth[i]!);
    } else {
      assertFinite(spec.growth.annualAmount, "Growth annualAmount must be finite.");
      v = prevRecurring + spec.growth.annualAmount;
    }
    for (const op of recurringOps) {
      if (overrideAppliesAt(op, i, tl)) {
        v = applyOverrideAt(op, v, tl);
      }
    }
    if (addNonRecurring) {
      v0 = v;
    }
    // Sanity: add overrides affect this year only; recurring chain (v) never includes them.
    let addSum = 0;
    for (const op of addOps) {
      if (overrideAppliesAt(op, i, tl)) {
        assertFinite(op.value, "Add override value must be finite.");
        addSum += op.value;
      }
    }
    out.push(v + addSum);
  }

  return out;
}

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

function applyOverrideAt(op: Override, value: number, tl: Timeline): number {
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

/**
 * Build series in a single forward pass: year i depends only on value[i-1] and growth[i],
 * then applies income overrides at i; next year compounds from the overridden value.
 * Eliminates snapback and flat-forever bugs (no save/restore or regrow patches).
 */
export function buildSeries(spec: ComponentSpec, tl: Timeline): number[] {
  assertFinite(spec.startValue, "startValue must be finite.");
  if (spec.growth.type === "pct") assertFinite(spec.growth.annualPct, "annualPct must be finite.");
  else assertFinite(spec.growth.annualAmount, "annualAmount must be finite.");

  const growth = buildGrowthByIndex(spec, tl);
  const ordered = orderOverrides(spec.overrides);

  const out: number[] = [spec.startValue];
  // Apply overrides at index 0 (e.g. "starting now" when fromAge = startAge)
  let v0 = out[0]!;
  for (const op of ordered) {
    if (overrideAppliesAt(op, 0, tl)) {
      v0 = applyOverrideAt(op, v0, tl);
    }
  }
  out[0] = v0;

  for (let i = 1; i < tl.length; i++) {
    const prev = out[i - 1]!;
    let v: number;
    if (spec.growth.type === "pct") {
      v = prev * (1 + growth[i]!);
    } else {
      assertFinite(spec.growth.annualAmount, "Growth annualAmount must be finite.");
      v = prev + spec.growth.annualAmount;
    }
    for (const op of ordered) {
      if (overrideAppliesAt(op, i, tl)) {
        v = applyOverrideAt(op, v, tl);
      }
    }
    out.push(v);
  }

  return out;
}

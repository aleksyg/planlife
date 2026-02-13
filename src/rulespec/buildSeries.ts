import type { ComponentSpec, Override, Timeline } from "./types";
import { yearIndexFromAge } from "./timeline";

function assertFinite(n: number, msg: string) {
  if (!Number.isFinite(n)) throw new Error(msg);
}

function normalizeToAge(tl: Timeline, fromAge: number, toAge: number | undefined): { fromIdx: number; toIdx: number } {
  const fromIdx = yearIndexFromAge(tl, fromAge);
  const toIdx = toAge == null ? tl.length - 1 : yearIndexFromAge(tl, toAge);
  if (toIdx < fromIdx) throw new Error(`Override range invalid: toAge < fromAge (${toAge} < ${fromAge}).`);
  return { fromIdx, toIdx };
}

function baselineValueAtIndex(spec: ComponentSpec, idx: number): number {
  if (spec.growth.type === "pct") {
    assertFinite(spec.growth.annualPct, "Growth annualPct must be finite.");
    return spec.startValue * Math.pow(1 + spec.growth.annualPct, Math.max(0, idx));
  }
  assertFinite(spec.growth.annualAmount, "Growth annualAmount must be finite.");
  return spec.startValue + spec.growth.annualAmount * Math.max(0, idx);
}

function regrowFromAnchor(spec: ComponentSpec, anchorIdx: number, anchorValue: number, out: number[]) {
  out[anchorIdx] = anchorValue;
  for (let j = anchorIdx + 1; j < out.length; j++) {
    const yearsSince = j - anchorIdx;
    if (spec.growth.type === "pct") out[j] = anchorValue * Math.pow(1 + spec.growth.annualPct, yearsSince);
    else out[j] = anchorValue + spec.growth.annualAmount * yearsSince;
  }
}

type OrderedOverride = { op: Override; idx: number };

function orderOverrides(ops: readonly Override[]): Override[] {
  const withIdx: OrderedOverride[] = ops.map((op, idx) => ({ op, idx }));
  withIdx.sort((a, b) => {
    if (a.op.fromAge !== b.op.fromAge) return a.op.fromAge - b.op.fromAge;
    const aTo = a.op.kind === "set" ? undefined : a.op.toAge;
    const bTo = b.op.kind === "set" ? undefined : b.op.toAge;
    if (aTo == null && bTo != null) return 1; // undefined last
    if (aTo != null && bTo == null) return -1;
    if (aTo != null && bTo != null && aTo !== bTo) return aTo - bTo;
    return a.idx - b.idx; // preserve input order
  });
  return withIdx.map((x) => x.op);
}

/**
 * Deterministically build a per-year series for a component.
 *
 * Supported overrides:
 * - open-ended set: anchor at fromAge and regrow forward
 * - add: add value over a range (toAge optional = through end)
 * - mult: multiply by factor over a range (toAge optional = through end)
 *
 * Not supported (throws): ranged set (toAge present)
 */
export function buildSeries(spec: ComponentSpec, tl: Timeline): number[] {
  assertFinite(spec.startValue, "startValue must be finite.");
  if (spec.growth.type === "pct") assertFinite(spec.growth.annualPct, "annualPct must be finite.");
  else assertFinite(spec.growth.annualAmount, "annualAmount must be finite.");

  const out: number[] = Array.from({ length: tl.length }, (_, idx) => baselineValueAtIndex(spec, idx));

  for (const op of orderOverrides(spec.overrides)) {
    assertFinite(op.value, "Override value must be finite.");
    if (op.kind === "set") {
      // No ranged set tonight.
      // (Later we can support via two anchors: set at fromAge and set back at toAge+1.)
      if ((op as { toAge?: number }).toAge != null) {
        throw new Error("Ranged 'set' overrides are not supported.");
      }
      const anchorIdx = yearIndexFromAge(tl, op.fromAge);
      if (op.value < 0) throw new Error("Set override value must be >= 0.");
      regrowFromAnchor(spec, anchorIdx, op.value, out);
      continue;
    }

    const { fromIdx, toIdx } = normalizeToAge(tl, op.fromAge, op.toAge);
    if (op.kind === "add") {
      for (let i = fromIdx; i <= toIdx; i++) {
        out[i] = out[i]! + op.value;
        if (out[i]! < 0) throw new Error("Add override resulted in negative value.");
      }
      continue;
    }
    if (op.kind === "mult") {
      if (op.value <= 0) throw new Error("Mult override value must be > 0.");
      for (let i = fromIdx; i <= toIdx; i++) {
        out[i] = out[i]! * op.value;
        if (out[i]! < 0) throw new Error("Mult override resulted in negative value.");
      }
      continue;
    }

    const _exhaustive: never = op;
    return _exhaustive;
  }

  return out;
}


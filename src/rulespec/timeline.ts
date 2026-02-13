import type { Timeline } from "./types";

export function makeTimeline(startAge: number, endAge: number): Timeline {
  if (!Number.isFinite(startAge) || !Number.isFinite(endAge)) {
    throw new Error("Timeline ages must be finite numbers.");
  }
  if (!Number.isInteger(startAge) || !Number.isInteger(endAge)) {
    throw new Error("Timeline ages must be integers.");
  }
  if (endAge < startAge) throw new Error("Timeline endAge must be >= startAge.");
  return { startAge, endAge, length: endAge - startAge + 1 };
}

export function yearIndexFromAge(tl: Timeline, age: number): number {
  if (!Number.isFinite(age) || !Number.isInteger(age)) throw new Error("Override age must be an integer.");
  const idx = age - tl.startAge;
  if (idx < 0 || idx >= tl.length) {
    throw new Error(`Age ${age} out of bounds (timeline ${tl.startAge}..${tl.endAge}).`);
  }
  return idx;
}


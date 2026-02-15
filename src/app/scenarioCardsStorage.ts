"use client";

import type { ScenarioCard } from "@/scenario/modifiers";

const STORAGE_KEY = "planlife-scenario-cards";

function isTargetedOverride(x: unknown): x is import("@/rulespec/types").TargetedOverride {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.target === "string" &&
    (o.kind === "set" || o.kind === "add" || o.kind === "mult" || o.kind === "cap") &&
    typeof (o as { fromAge: unknown }).fromAge === "number" &&
    typeof (o as { value: unknown }).value === "number"
  );
}

function parseCard(raw: unknown): ScenarioCard | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const createdAt = o.createdAt;
  const title = o.title;
  const summary = o.summary;
  const enabled = o.enabled;
  const overrides = o.overrides;
  if (typeof id !== "string" || !id) return null;
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null;
  if (typeof title !== "string") return null;
  if (typeof summary !== "string") return null;
  if (typeof enabled !== "boolean") return null;
  if (!Array.isArray(overrides)) return null;
  const parsed: import("@/rulespec/types").TargetedOverride[] = [];
  for (const item of overrides) {
    if (!isTargetedOverride(item)) return null;
    parsed.push(item);
  }
  return {
    id,
    createdAt,
    title: title || "Untitled change",
    summary: summary ?? "",
    enabled,
    overrides: parsed,
  };
}

export function loadScenarioCards(): ScenarioCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cards: ScenarioCard[] = [];
    for (const item of parsed) {
      const card = parseCard(item);
      if (card) cards.push(card);
    }
    return cards.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export function saveScenarioCards(cards: ScenarioCard[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // ignore
  }
}

export function createScenarioCard(args: {
  title: string;
  summary: string;
  overrides: import("@/rulespec/types").TargetedOverride[];
}): ScenarioCard {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `card-${Date.now()}`,
    createdAt: Date.now(),
    title: args.title || "Untitled change",
    summary: args.summary ?? "",
    enabled: true,
    overrides: [...args.overrides],
  };
}

import type { LifeEvent } from "@/scenario/lifeEvents/types";

const STORAGE_KEY = "planlife-life-events";

function parseLifeEvent(raw: unknown): LifeEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const title = o.title;
  const enabled = o.enabled;
  const summary = o.summary;
  const mutations = o.mutations;
  const templateKey = o.templateKey;
  if (typeof id !== "string" || !id) return null;
  if (typeof title !== "string") return null;
  if (typeof enabled !== "boolean") return null;
  if (!Array.isArray(summary)) return null;
  if (!summary.every((s) => typeof s === "string")) return null;
  if (!Array.isArray(mutations)) return null;
  return {
    id,
    title,
    enabled,
    summary: [...summary],
    mutations: [...mutations],
    ...(typeof templateKey === "string" && templateKey ? { templateKey: templateKey as LifeEvent["templateKey"] } : {}),
  };
}

export function loadLifeEvents(): LifeEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const events: LifeEvent[] = [];
    for (const item of parsed) {
      const ev = parseLifeEvent(item);
      if (ev) events.push(ev);
    }
    return events;
  } catch {
    return [];
  }
}

export function saveLifeEvents(events: LifeEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

import type { LifeEvent, LifeEventTemplateKey } from "./types";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function makeLifeEvent(params: {
  title: string;
  templateKey?: LifeEventTemplateKey;
}): LifeEvent {
  return {
    id: makeId(),
    title: params.title,
    enabled: true,
    summary: [
      "No impacts defined yet",
      "Add impacts under Income / Expenses / Debt",
    ],
    mutations: [],
    templateKey: params.templateKey,
  };
}

import OpenAI from "openai";
import type { AiChatMessage, AiPlannerResponse, AiHelperResponse, TargetedOverride } from "@/ai/types";
import type { AiPromptPayload } from "@/ai/promptPayload";
import { getLastUserText, promptMentionsPartner } from "@/ai/compiler/promptFacts";
import { computeConfirmationsRequiredFromOverrides, isPartnerOverrideTarget } from "@/ai/compiler/confirmations";
import { deriveIncomeIntent, type IncomeIntent } from "@/ai/compiler/incomeIntent";
import {
  materializeTotalCompConstraint,
  type TotalCompConstraint,
  type ResolutionPolicy,
} from "@/ai/compiler/totalCompConstraint";

type RequestBody = {
  messages: AiChatMessage[];
  context: AiPromptPayload;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function badRequest(message: string, details?: unknown) {
  return Response.json(
    { error: message, details },
    { status: 400, headers: { "content-type": "application/json" } },
  );
}

// (deterministic compiler helpers live in src/ai/compiler/*)

const TARGET_KEYS = [
  "income.user.base",
  "income.user.bonus",
  "income.partner.base",
  "income.partner.bonus",
  "income.user.base.growthPct",
  "income.partner.base.growthPct",
  "income.user.bonus.growthPct",
  "income.partner.bonus.growthPct",
  "spend.lifestyle",
  "spend.housing",
] as const;

function getJsonSchema() {
  return {
    type: "json_schema",
    name: "planlife_ai_planner_response",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: { enum: ["clarify", "propose", "open_helper"] },
        questions: { type: ["array", "null"], items: { type: "string" } },
        assumptions: { type: ["array", "null"], items: { type: "string" } },
        draftScenarioSummary: { type: ["string", "null"] },
        impactPreviewRequest: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            focusYearIndex: { type: ["number", "null"] },
          },
          required: ["focusYearIndex"],
        },
        overrides: {
          type: ["array", "null"],
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              target: {
                enum: [
                  "income.user.base",
                  "income.user.bonus",
                  "income.partner.base",
                  "income.partner.bonus",
                  "income.user.base.growthPct",
                  "income.partner.base.growthPct",
                  "income.user.bonus.growthPct",
                  "income.partner.bonus.growthPct",
                  "spend.lifestyle",
                  "spend.housing",
                ],
              },
              kind: { enum: ["set", "add", "mult", "cap"] },
              fromAge: { type: "number" },
              toAge: { type: ["number", "null"] },
              value: { type: "number" },
            },
            required: ["target", "kind", "fromAge", "toAge", "value"],
          },
        },
        totalCompTarget: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            fromAge: { type: "number" },
            value: { type: "number" },
            who: { enum: ["user", "partner"] },
          },
          required: ["fromAge", "value", "who"],
        },
        totalCompConstraint: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            person: { enum: ["user", "partner"] },
            milestones: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: { age: { type: "number" }, value: { type: "number" } },
                required: ["age", "value"],
              },
            },
            cap: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: { value: { type: "number" }, startAge: { type: "number" } },
              required: ["value", "startAge"],
            },
            resolutionPolicy: { enum: ["BASE_ONLY", "BONUS_ONLY", "PROPORTIONAL", "ASK"] },
          },
          required: ["person", "milestones", "cap", "resolutionPolicy"],
        },
        helper: { type: ["string", "null"], enum: ["income", "home", "expense", "retirement", "oneTimeEvent", null] },
        prefill: { type: ["object", "null"], additionalProperties: true },
        openHelperMessage: { type: ["string", "null"] },
        openHelperAssumptions: { type: ["array", "null"], items: { type: "string" } },
      },
      required: [
        "mode",
        "questions",
        "assumptions",
        "draftScenarioSummary",
        "impactPreviewRequest",
        "overrides",
        "totalCompTarget",
        "totalCompConstraint",
        "helper",
        "prefill",
        "openHelperMessage",
        "openHelperAssumptions",
      ],
    },
  } as const;
}

function validateAndNormalizeOverride(
  obj: unknown,
  ctx: AiPromptPayload,
): { override: TargetedOverride | null; error: string | null } {
  const hasPartner = ctx.currentValues.hasPartner;
  const startAge = ctx.currentValues.startAge;
  const endAge = ctx.currentValues.endAge;
  const b = ctx.allowedMutations;
  const inRange = (v: number, min: number, max: number) => v >= min && v <= max;
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

  const yearsSpan = endAge - startAge; // e.g. 52-30 = 22
  const asIntIfClose = (x: number) => {
    const r = Math.round(x);
    return Math.abs(x - r) < 1e-6 ? r : null;
  };

  // Accept either:
  // - absolute age (e.g. 30..52), OR
  // - yearIndex offset (e.g. 0..yearsSpan) meaning startAge + offset
  const normalizeAge = (raw: number): number | null => {
    // If it looks like a yearIndex offset, convert to absolute age.
    if (raw < startAge && raw >= 0 && raw <= yearsSpan) {
      const rawInt = asIntIfClose(raw);
      if (rawInt == null) return null;
      return startAge + rawInt;
    }

    // Otherwise treat as absolute age (must be integer).
    const ageInt = asIntIfClose(raw);
    if (ageInt == null) return null;
    return ageInt;
  };

  if (!isRecord(obj) || typeof obj["target"] !== "string" || typeof obj["kind"] !== "string") {
    return { override: null, error: "Invalid override: expected object with target and kind." };
  }

  const target = obj["target"] as string;
  if (!TARGET_KEYS.includes(target as (typeof TARGET_KEYS)[number])) {
    return { override: null, error: `Invalid target: ${target}.` };
  }

  const partnerTargets = [
    "income.partner.base",
    "income.partner.bonus",
    "income.partner.base.growthPct",
    "income.partner.bonus.growthPct",
  ];
  if (partnerTargets.includes(target) && !hasPartner) {
    return { override: null, error: "Cannot set partner override: baseline has no partner." };
  }

  const kind = obj["kind"] as string;
  if (kind !== "set" && kind !== "add" && kind !== "mult" && kind !== "cap") {
    return { override: null, error: "kind must be set, add, mult, or cap." };
  }

  const isGrowthPct = target.endsWith(".growthPct");
  if (isGrowthPct && kind !== "set") {
    return { override: null, error: "Growth targets only support kind 'set'." };
  }
  if (kind === "cap" && target.endsWith(".growthPct")) {
    return { override: null, error: "Cap is not supported for growth targets." };
  }

  const fromAgeRaw = obj["fromAge"];
  if (!isNum(fromAgeRaw)) return { override: null, error: "fromAge must be a number." };

  const fromAge = normalizeAge(fromAgeRaw);
  if (fromAge == null) {
    return { override: null, error: "fromAge must be an integer age (or an integer yearIndex like 0 for now)." };
  }
  if (!inRange(fromAge, startAge, endAge)) {
    return { override: null, error: `fromAge must be between ${startAge} and ${endAge}.` };
  }

  const toAgeRaw = obj["toAge"];
  let toAge: number | undefined;
  if (toAgeRaw !== null && toAgeRaw !== undefined) {
    if (!isNum(toAgeRaw)) return { override: null, error: "toAge must be a number or null." };

    const toAgeNorm = normalizeAge(toAgeRaw);
    if (toAgeNorm == null) {
      return { override: null, error: "toAge must be an integer age (or an integer yearIndex like 1 for next year)." };
    }
    if (!inRange(toAgeNorm, startAge, endAge)) {
      return { override: null, error: `toAge must be between ${startAge} and ${endAge}.` };
    }
    if (toAgeNorm < fromAge) return { override: null, error: "toAge must be >= fromAge." };
    toAge = toAgeNorm;
  }

  const value = obj["value"];
  if (!isNum(value)) return { override: null, error: "value must be a number." };

  if (isGrowthPct) {
    if (!inRange(value, b.growthRate.min, b.growthRate.max)) {
      return { override: null, error: `Growth rate must be between ${b.growthRate.min} and ${b.growthRate.max}.` };
    }
    return {
      override: { target: target as TargetedOverride["target"], kind: "set", fromAge, toAge, value },
      error: null,
    };
  }

  const isSpend = target === "spend.lifestyle" || target === "spend.housing";
  if (kind === "cap" && isSpend) {
    return { override: null, error: "Cap is only supported for income targets." };
  }
  if (isSpend) {
    if (!inRange(value, b.monthlyDollars.min, b.monthlyDollars.max)) {
      return { override: null, error: `Monthly value out of range (${b.monthlyDollars.min}..${b.monthlyDollars.max}).` };
    }
  } else {
    if (!inRange(value, b.dollars.min, b.dollars.max)) {
      return { override: null, error: `Annual value out of range (${b.dollars.min}..${b.dollars.max}).` };
    }
  }
  if (kind === "set" && isSpend && value < 0) return { override: null, error: "Set value for spend must be >= 0." };
  if (kind === "set" && !isSpend && value < 0) return { override: null, error: "Set value for income must be >= 0." };
  if (kind === "mult" && value <= 0) return { override: null, error: "Mult value must be > 0." };
  if (kind === "cap" && value < 0) return { override: null, error: "Cap value must be >= 0." };

  return {
    override: { target: target as TargetedOverride["target"], kind: kind as "set" | "add" | "mult" | "cap", fromAge, toAge, value },
    error: null,
  };
}

function parseTotalCompConstraint(obj: unknown): TotalCompConstraint | null {
  if (!isRecord(obj)) return null;
  const person = obj["person"];
  if (person !== "user" && person !== "partner") return null;
  const milestonesRaw = obj["milestones"];
  if (!Array.isArray(milestonesRaw)) return null;
  const milestones: { age: number; value: number }[] = [];
  for (const m of milestonesRaw) {
    if (isRecord(m) && typeof m["age"] === "number" && typeof m["value"] === "number") {
      milestones.push({ age: m["age"], value: m["value"] });
    }
  }
  if (milestones.length === 0) return null;
  let cap: { value: number; startAge: number } | undefined;
  const capRaw = obj["cap"];
  if (isRecord(capRaw) && typeof capRaw["value"] === "number" && typeof capRaw["startAge"] === "number") {
    cap = { value: capRaw["value"], startAge: capRaw["startAge"] };
  }
  const resolutionPolicy = obj["resolutionPolicy"];
  const rp =
    resolutionPolicy === "BASE_ONLY" ||
    resolutionPolicy === "BONUS_ONLY" ||
    resolutionPolicy === "PROPORTIONAL" ||
    resolutionPolicy === "ASK"
      ? (resolutionPolicy as ResolutionPolicy)
      : undefined;
  return { person, milestones, cap, resolutionPolicy: rp };
}

const HELPER_TYPES = ["income", "home", "expense", "retirement", "oneTimeEvent"] as const;
type HelperType = (typeof HELPER_TYPES)[number];

function validatePlannerShape(obj: unknown): {
  mode: "clarify" | "propose" | "open_helper";
  questions: string[] | null;
  assumptions: string[] | null;
  draftScenarioSummary: string | null;
  impactPreviewRequest: { focusYearIndex: number | null } | null;
  overrides: unknown[] | null;
  totalCompTarget: { fromAge: number; value: number; who: "user" | "partner" } | null;
  totalCompConstraint: TotalCompConstraint | null;
  helper: HelperType | null;
  prefill: Record<string, unknown> | null;
  openHelperMessage: string | null;
  openHelperAssumptions: string[] | null;
} | null {
  if (!isRecord(obj)) return null;
  const mode = obj["mode"];
  if (mode !== "clarify" && mode !== "propose" && mode !== "open_helper") return null;
  const questions = Array.isArray(obj["questions"]) ? (obj["questions"] as unknown[]).filter((x) => typeof x === "string") as string[] : null;
  const assumptions = Array.isArray(obj["assumptions"]) ? (obj["assumptions"] as unknown[]).filter((x) => typeof x === "string") as string[] : null;
  const draftScenarioSummary = typeof obj["draftScenarioSummary"] === "string" ? (obj["draftScenarioSummary"] as string) : null;
  const impact = isRecord(obj["impactPreviewRequest"]) ? obj["impactPreviewRequest"] : null;
  const impactPreviewRequest = impact
    ? { focusYearIndex: typeof impact["focusYearIndex"] === "number" ? (impact["focusYearIndex"] as number) : null }
    : null;
  const overrides = Array.isArray(obj["overrides"]) ? (obj["overrides"] as unknown[]) : null;
  let totalCompTarget: { fromAge: number; value: number; who: "user" | "partner" } | null = null;
  const tct = obj["totalCompTarget"];
  if (isRecord(tct) && typeof tct["fromAge"] === "number" && typeof tct["value"] === "number" && (tct["who"] === "user" || tct["who"] === "partner")) {
    totalCompTarget = { fromAge: tct["fromAge"], value: tct["value"], who: tct["who"] };
  }
  const totalCompConstraint = parseTotalCompConstraint(obj["totalCompConstraint"]);
  const helperRaw = obj["helper"];
  const helper =
    typeof helperRaw === "string" && HELPER_TYPES.includes(helperRaw as HelperType) ? (helperRaw as HelperType) : null;
  const prefillRaw = obj["prefill"];
  const prefill = prefillRaw != null && typeof prefillRaw === "object" ? (prefillRaw as Record<string, unknown>) : {};
  const openHelperMessage = typeof obj["openHelperMessage"] === "string" ? obj["openHelperMessage"] : null;
  const openHelperAssumptions = Array.isArray(obj["openHelperAssumptions"])
    ? (obj["openHelperAssumptions"] as unknown[]).filter((x) => typeof x === "string") as string[]
    : null;
  return {
    mode,
    questions,
    assumptions,
    draftScenarioSummary,
    impactPreviewRequest,
    overrides,
    totalCompTarget,
    totalCompConstraint,
    helper,
    prefill: prefill ?? null,
    openHelperMessage,
    openHelperAssumptions,
  };
}

/** Deterministic: base so that base + bonusAtFromAge = targetTotalComp. Uses bonus at same age from context, or specifiedBonus when provided (BONUS_AND_TOTAL_COMP). */
function baseForTargetTotalComp(
  ctx: AiPromptPayload,
  fromAge: number,
  targetTotalComp: number,
  who: "user" | "partner",
  specifiedBonus?: number,
): { base: number; assumption: string } {
  const startAge = ctx.currentValues.startAge;
  const yearIndex = fromAge - startAge;
  const bonusByYear = who === "user" ? ctx.series.userBonusByYear : ctx.series.partnerBonusByYear;
  const projectedBonus = yearIndex >= 0 && yearIndex < bonusByYear.length ? bonusByYear[yearIndex]! : 0;
  const bonusAtFromAge = specifiedBonus !== undefined ? specifiedBonus : projectedBonus;
  const base = Math.max(0, targetTotalComp - bonusAtFromAge);
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  if (targetTotalComp < bonusAtFromAge) {
    return {
      base: 0,
      assumption: `Target total comp ${fmt(targetTotalComp)} is below your projected bonus at that age (${fmt(bonusAtFromAge)}); base set to $0.`,
    };
  }
  if (specifiedBonus !== undefined) {
    return { base, assumption: `Using your specified bonus ${fmt(specifiedBonus)} at age ${fromAge}; base set to ~${fmt(base)} so total comp is ${fmt(targetTotalComp)}.` };
  }
  return {
    base,
    assumption: `Bonus follows your current bonus path (incl growth), ~${fmt(bonusAtFromAge)} at age ${fromAge}; base set to ~${fmt(base)} so total comp is ${fmt(targetTotalComp)}.`,
  };
}

function isBaseTarget(t: string): boolean {
  return t === "income.user.base" || t === "income.partner.base" || t === "income.user.base.growthPct" || t === "income.partner.base.growthPct";
}
function isBonusTarget(t: string): boolean {
  return t === "income.user.bonus" || t === "income.partner.bonus" || t === "income.user.bonus.growthPct" || t === "income.partner.bonus.growthPct";
}

/** Gate and normalize proposed overrides + totalCompTarget + totalCompConstraint by deterministic income intent. */
function applyIntentGate(
  intent: IncomeIntent,
  overrides: TargetedOverride[],
  totalCompTarget: { fromAge: number; value: number; who: "user" | "partner" } | null,
  totalCompConstraint: TotalCompConstraint | null,
): {
  overrides: TargetedOverride[];
  totalCompTarget: { fromAge: number; value: number; who: "user" | "partner" } | null;
  totalCompConstraint: TotalCompConstraint | null;
  forceClarify: boolean;
  clarifyReason?: string;
} {
  if (intent === "AMBIGUOUS_CONFLICT") {
    return {
      overrides: [],
      totalCompTarget: null,
      totalCompConstraint: null,
      forceClarify: true,
      clarifyReason:
        "Your request sounds like a cap or limit without a clear field (base vs bonus vs total comp). Can you specify what to change?",
    };
  }

  if (intent === "BONUS_ONLY") {
    const allowed = overrides.filter((o) => isBonusTarget(o.target) || (!isBaseTarget(o.target) && !isBonusTarget(o.target)));
    return { overrides: allowed, totalCompTarget: null, totalCompConstraint: null, forceClarify: false };
  }

  if (intent === "TOTAL_COMP_ONLY") {
    const allowed = overrides.filter((o) => !isBonusTarget(o.target));
    return { overrides: allowed, totalCompTarget, totalCompConstraint, forceClarify: false };
  }

  if (intent === "BASE_ONLY") {
    const allowed = overrides.filter((o) => !isBonusTarget(o.target));
    return { overrides: allowed, totalCompTarget: null, totalCompConstraint: null, forceClarify: false };
  }

  if (intent === "BONUS_AND_TOTAL_COMP") {
    return { overrides, totalCompTarget, totalCompConstraint, forceClarify: false };
  }

  return { overrides, totalCompTarget, totalCompConstraint, forceClarify: false };
}

export async function POST(req: Request) {
  console.log("[/api/ai] HIT");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[/api/ai] Missing OPENAI_API_KEY");
    return badRequest("OPENAI_API_KEY is not set.");
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    console.error("[/api/ai] Invalid JSON body");
    return badRequest("Invalid JSON body.");
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) return badRequest("messages is required.");
  if (!body.context) return badRequest("context is required.");

  const client = new OpenAI({ apiKey });
  const requestedModel = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

  // Structured outputs with json_schema require supported model snapshots.
  const model =
    requestedModel === "gpt-4o-mini"
//      ? "gpt-4o-2024-08-06"
  //    : requestedModel === "gpt-4o-mini"
        ? "gpt-4o-mini-2024-07-18"
        : requestedModel;

  console.log("[/api/ai] Config", {
    model,
    hasKey: true,
    messageCount: body.messages.length,
  });

  const system = [
    "You are Planlife AI, a conversational scenario planner.",
    "context.currentValues reflects the current scenario after applying all enabled cards. Propose only the additional changes needed from the current scenario; do not restate existing enabled overrides.",
    "Income semantics: When user asks for total comp (e.g. 'income to 800k', 'make 800k', 'total comp 800k') at a single age, output totalCompTarget: { fromAge, value, who }. Do NOT output income.user.base for that — the server computes base from bonus. For multi-year targets (e.g. '$1M in 4 years, $2M in 10 years') or a cap (e.g. 'cap at $2.5M'), output totalCompConstraint: { person, milestones: [{ age, value }, ...], cap?: { value, startAge }, resolutionPolicy: 'BASE_ONLY' | 'BONUS_ONLY' | 'PROPORTIONAL' | 'ASK' }. If the user does not specify how to hit the targets, use resolutionPolicy: 'ASK' so the server can ask. Only output income.user.base or income.user.bonus overrides when user explicitly says 'base'/'salary' or 'bonus'. Caps are enforced as hard ceilings (no growth above cap).",
    "When user says 'back to normal' or 'go back to normal' after a temporary range: add a second override at rejoin age (first year after the range) setting income.user.base to context.series.baselineUserBaseByYear[rejoinYearIndex] so total comp rejoins the baseline path. Add assumption: 'Back to normal means rejoining your baseline total compensation at age X.'",
    "Classify the user message: mode='clarify' (ask questions), mode='propose' (assumptions + overrides), or mode='open_helper' when the user wants to edit income/retirement/home/expense via a form. For open_helper: set helper to 'income'|'home'|'expense'|'retirement'|'oneTimeEvent', prefill with inferred values (e.g. baseAnnual, growthRate), and openHelperMessage with a short sentence. Do NOT return overrides when mode=open_helper.",
    "Return JSON only and conform to the provided JSON Schema.",
    "Propose overrides with: target (e.g. income.user.base, income.user.bonus, spend.lifestyle), kind (set|add|mult|cap), fromAge (plan age), toAge (number or null), value.",
    "Use fromAge (plan age), not yearIndex. age = context.currentValues.startAge + yearIndex.",
    "Open-ended (e.g. permanent raise): set toAge to null. Ranged override: set toAge to the last age in the range.",
    "For growth rate changes use target income.user.base.growthPct (or income.user.bonus.growthPct, income.partner.base.growthPct, income.partner.bonus.growthPct) with value as decimal (e.g. 0.04 for 4%). Only kind 'set' for growth targets.",
    "Never invent projection numbers; all impacts are computed by the engine.",
    "Hard rule: never propose partner overrides unless the user explicitly references partner/wife/husband/spouse.",
    "For a permanent base salary change at a given age: target income.user.base, kind set, fromAge = that age, toAge null, value = new base. Income will then compound from that anchor.",
    "For time off / sabbatical: set income.user.base to 0 at fromAge, toAge = last year off; then set income.user.base to return salary at fromAge = first year back, toAge null.",
    "If ambiguous, choose mode='clarify' with 1–5 targeted questions and explicit assumptions.",
  ].join("\n");

  const user = {
    messages: body.messages,
    context: body.context,
  };

  let rawText: string | undefined;

  // ✅ ONLY place we call OpenAI — instrumented hard
  try {
    const params = {
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(user) }] },
      ],
      text: { format: getJsonSchema() },
    };

    console.log("[/api/ai] Calling OpenAI responses.create...");

    const t0 = Date.now();
    const respUnknown: unknown = await client.responses.create(
      params as unknown as Parameters<typeof client.responses.create>[0],
    );
    const resp = (respUnknown ?? {}) as Record<string, unknown>;
    const ms = Date.now() - t0;

    // ✅ Definitive proof you hit OpenAI
    console.log("[/api/ai] OPENAI OK", {
      id: resp["id"],
      model: resp["model"],
      ms,
      usage: resp["usage"], // tokens attribution (may be undefined for some SDK versions)
    });

    rawText = typeof resp["output_text"] === "string" ? (resp["output_text"] as string) : undefined;
    if (!rawText) {
      // Fallback extraction
      const output = resp["output"];
      if (Array.isArray(output)) {
        const first = output[0] as unknown;
        const content = isRecord(first) ? first["content"] : undefined;
        const out = Array.isArray(content) ? content[0]?.text : undefined;
        if (typeof out === "string") rawText = out;
      }
    }

    console.log("[/api/ai] OpenAI returned text chars:", rawText?.length ?? 0);
  } catch (err: unknown) {
    const e = err as unknown;
    const response = isRecord(e) ? e["response"] : undefined;
    const errorObj = isRecord(e) ? e["error"] : undefined;
    const status =
      isRecord(e) && (typeof e["status"] === "number" || typeof e["status"] === "string")
        ? e["status"]
        : isRecord(response) && (typeof response["status"] === "number" || typeof response["status"] === "string")
          ? response["status"]
          : undefined;

    const message =
      isRecord(errorObj) && typeof errorObj["message"] === "string"
        ? errorObj["message"]
        : isRecord(e) && typeof e["message"] === "string"
          ? (e["message"] as string)
          : String(err);

    console.error("[/api/ai] OPENAI FAIL", {
      status,
      message,
    });

    return Response.json(
      {
        error: `OpenAI request failed${status ? ` (${status})` : ""}: ${message}`,
      },
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  if (!rawText) return badRequest("OpenAI returned no text output.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return badRequest("OpenAI output was not valid JSON.", { rawText });
  }

  const shape = validatePlannerShape(parsed);
  if (!shape) return badRequest("OpenAI output did not match expected shape.", { parsed });

  const lastUserText = getLastUserText(body.messages);
  const partnerMentioned = promptMentionsPartner(lastUserText);

  if (shape.mode === "clarify") {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: shape.questions ?? [],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }

  if (shape.mode === "open_helper") {
    const helper = shape.helper ?? "income";
    const prefill = shape.prefill ?? {};
    const out: AiHelperResponse = {
      mode: "open_helper",
      helper: HELPER_TYPES.includes(helper) ? helper : "income",
      prefill: typeof prefill === "object" ? prefill : {},
      assumptions: shape.openHelperAssumptions ?? shape.assumptions ?? [],
      message: shape.openHelperMessage ?? undefined,
    };
    return Response.json(out);
  }

  // propose mode
  const proposedOverridesRaw = shape.overrides ?? [];
  const errors: string[] = [];
  const overrides: TargetedOverride[] = [];

  const hasConstraint =
    shape.totalCompConstraint &&
    shape.totalCompConstraint.milestones.length > 0;
  const constraintNeedsPolicy =
    hasConstraint &&
    (!shape.totalCompConstraint!.resolutionPolicy || shape.totalCompConstraint!.resolutionPolicy === "ASK");

  if (constraintNeedsPolicy) {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: [
        "To hit these total comp targets, should I adjust base only, bonus only, or both proportionally?",
      ],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }

  if (proposedOverridesRaw.length === 0 && !shape.totalCompTarget && !hasConstraint) {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: ["What change do you want to make (who, amount, and when)? I didn’t receive any actionable overrides."],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }

  for (const o of proposedOverridesRaw) {
    const { override, error } = validateAndNormalizeOverride(o, body.context);
    if (error) errors.push(error);
    else if (override) overrides.push(override);
  }

  // Intent gating: restrict income actions so bonus-only never changes base, etc.
  const intent = deriveIncomeIntent(lastUserText);
  const gated = applyIntentGate(intent, overrides, shape.totalCompTarget, shape.totalCompConstraint);
  if (gated.forceClarify) {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: [gated.clarifyReason ?? "Can you clarify what you’d like to change (base, bonus, or total comp)?"],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }
  overrides.length = 0;
  overrides.push(...gated.overrides);
  const effectiveTotalCompTarget = gated.totalCompTarget;
  const effectiveConstraint = gated.totalCompConstraint;
  const hasGatedConstraint =
    effectiveConstraint != null && effectiveConstraint.milestones.length > 0;

  // Materialize TOTAL_COMP_CONSTRAINT (multi-year / cap) when resolutionPolicy is set
  const assumptionsFromShape = [...(shape.assumptions ?? [])];
  let constraintAppliedForPerson: "user" | "partner" | null = null;
  if (hasGatedConstraint && effectiveConstraint!.resolutionPolicy && effectiveConstraint!.resolutionPolicy !== "ASK") {
    const result = materializeTotalCompConstraint(body.context, effectiveConstraint!);
    if (result.error && result.overrides.length === 0) {
      const out: AiPlannerResponse = {
        mode: "clarify",
        questions: [result.error],
        assumptions: assumptionsFromShape,
      };
      return Response.json(out);
    }
    overrides.push(...result.overrides);
    assumptionsFromShape.push(...result.assumptions);
    constraintAppliedForPerson = effectiveConstraint!.person;
  }

  if (overrides.length === 0 && !effectiveTotalCompTarget) {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: ["That would only change base or total comp; you asked for bonus-only (or the opposite). Should I only change bonus, or did you mean total comp?"],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }

  // Apply single-point totalCompTarget only when intent allows and not already handled by constraint
  if (effectiveTotalCompTarget && effectiveTotalCompTarget.who !== constraintAppliedForPerson) {
    const { fromAge, value: targetTotalComp, who } = effectiveTotalCompTarget;
    if (who === "partner" && !body.context.currentValues.hasPartner) {
      assumptionsFromShape.push("Partner total comp ignored (no partner in plan).");
    } else {
      const bonusTarget = who === "user" ? "income.user.bonus" : "income.partner.bonus";
      const specifiedBonus = intent === "BONUS_AND_TOTAL_COMP"
        ? overrides.find((o) => o.target === bonusTarget && o.fromAge === fromAge)?.value
        : undefined;
      const { base, assumption } = baseForTargetTotalComp(body.context, fromAge, targetTotalComp, who, specifiedBonus);
      const targetKey = who === "user" ? "income.user.base" : "income.partner.base";
      overrides.push({
        target: targetKey as TargetedOverride["target"],
        kind: "set" as const,
        fromAge,
        toAge: undefined,
        value: base,
      });
      assumptionsFromShape.push(assumption);
    }
  }

  const partnerOverrides = overrides.filter(isPartnerOverrideTarget);
  if (partnerOverrides.length > 0 && !partnerMentioned) {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: [
        "Are you asking to change your partner’s income or settings? If yes, please mention partner/wife/husband explicitly.",
      ],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }

  if (errors.length > 0) {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: [
        "I can’t propose overrides yet because some requested changes were out of bounds or incomplete. Can you confirm the intended values (amounts, timing, and who they apply to)?",
      ],
      assumptions: [...(shape.assumptions ?? []), ...errors],
    };
    return Response.json(out);
  }

  const confirmationsRequired = computeConfirmationsRequiredFromOverrides(overrides, body.context);
  const impactPreviewRequest =
    shape.impactPreviewRequest && shape.impactPreviewRequest.focusYearIndex != null
      ? { focusYearIndex: shape.impactPreviewRequest.focusYearIndex }
      : undefined;

  const out: AiPlannerResponse = {
    mode: "propose",
    assumptions: assumptionsFromShape,
    overrides,
    draftScenarioSummary: shape.draftScenarioSummary ?? undefined,
    impactPreviewRequest,
    confirmationsRequired: confirmationsRequired.length ? confirmationsRequired : undefined,
  };
  return Response.json(out);
}

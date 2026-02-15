import OpenAI from "openai";
import type { AiChatMessage, AiPlannerResponse, TargetedOverride } from "@/ai/types";
import type { AiPromptPayload } from "@/ai/promptPayload";
import { getLastUserText, promptMentionsPartner } from "@/ai/compiler/promptFacts";
import { computeConfirmationsRequiredFromOverrides, isPartnerOverrideTarget } from "@/ai/compiler/confirmations";

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
        mode: { enum: ["clarify", "propose"] },
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
              kind: { enum: ["set", "add", "mult"] },
              fromAge: { type: "number" },
              toAge: { type: ["number", "null"] },
              value: { type: "number" },
            },
            required: ["target", "kind", "fromAge", "toAge", "value"],
          },
        },
      },
      required: [
        "mode",
        "questions",
        "assumptions",
        "draftScenarioSummary",
        "impactPreviewRequest",
        "overrides",
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
  if (kind !== "set" && kind !== "add" && kind !== "mult") {
    return { override: null, error: "kind must be set, add, or mult." };
  }

  const isGrowthPct = target.endsWith(".growthPct");
  if (isGrowthPct && kind !== "set") {
    return { override: null, error: "Growth targets only support kind 'set'." };
  }

  const fromAge = obj["fromAge"];
  if (!isNum(fromAge)) return { override: null, error: "fromAge must be a number." };
  if (!inRange(fromAge, startAge, endAge)) {
    return { override: null, error: `fromAge must be between ${startAge} and ${endAge}.` };
  }

  const toAgeRaw = obj["toAge"];
  let toAge: number | undefined;
  if (toAgeRaw !== null && toAgeRaw !== undefined) {
    if (!isNum(toAgeRaw)) return { override: null, error: "toAge must be a number or null." };
    if (!inRange(toAgeRaw, startAge, endAge)) {
      return { override: null, error: `toAge must be between ${startAge} and ${endAge}.` };
    }
    if (toAgeRaw < fromAge) return { override: null, error: "toAge must be >= fromAge." };
    toAge = toAgeRaw;
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

  return {
    override: { target: target as TargetedOverride["target"], kind: kind as "set" | "add" | "mult", fromAge, toAge, value },
    error: null,
  };
}

function validatePlannerShape(obj: unknown): {
  mode: "clarify" | "propose";
  questions: string[] | null;
  assumptions: string[] | null;
  draftScenarioSummary: string | null;
  impactPreviewRequest: { focusYearIndex: number | null } | null;
  overrides: unknown[] | null;
} | null {
  if (!isRecord(obj)) return null;
  const mode = obj["mode"];
  if (mode !== "clarify" && mode !== "propose") return null;
  const questions = Array.isArray(obj["questions"]) ? (obj["questions"] as unknown[]).filter((x) => typeof x === "string") as string[] : null;
  const assumptions = Array.isArray(obj["assumptions"]) ? (obj["assumptions"] as unknown[]).filter((x) => typeof x === "string") as string[] : null;
  const draftScenarioSummary = typeof obj["draftScenarioSummary"] === "string" ? (obj["draftScenarioSummary"] as string) : null;
  const impact = isRecord(obj["impactPreviewRequest"]) ? obj["impactPreviewRequest"] : null;
  const impactPreviewRequest = impact
    ? { focusYearIndex: typeof impact["focusYearIndex"] === "number" ? (impact["focusYearIndex"] as number) : null }
    : null;
  const overrides = Array.isArray(obj["overrides"]) ? (obj["overrides"] as unknown[]) : null;
  return { mode, questions, assumptions, draftScenarioSummary, impactPreviewRequest, overrides };
}

// ...everything above unchanged...

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
    "Classify the user message into either mode='clarify' (ask questions, no overrides) or mode='propose' (assumptions + overrides).",
    "Return JSON only and conform to the provided JSON Schema.",
    "Propose overrides with: target (e.g. income.user.base, spend.lifestyle), kind (set|add|mult), fromAge (plan age), toAge (number or null), value.",
    "Use fromAge (plan age), not yearIndex. age = context.currentValues.startAge + yearIndex.",
    "Open-ended (e.g. permanent raise): set toAge to null. Ranged override: set toAge to the last age in the range.",
    "For growth rate changes use target income.user.base.growthPct (or income.user.bonus.growthPct, income.partner.base.growthPct, income.partner.bonus.growthPct) with value as decimal (e.g. 0.04 for 4%). Only kind 'set' for growth targets.",
    "Never invent projection numbers; all impacts are computed by the engine.",
    "Hard rule: never propose partner overrides unless the user explicitly references partner/wife/husband/spouse.",
    "For a permanent salary change at a given age: target income.user.base, kind set, fromAge = that age, toAge null, value = new salary. Income will then compound from that anchor.",
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

  // propose mode
  const proposedOverridesRaw = shape.overrides ?? [];
  const errors: string[] = [];
  const overrides: TargetedOverride[] = [];

  if (proposedOverridesRaw.length === 0) {
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
    assumptions: shape.assumptions ?? [],
    overrides,
    draftScenarioSummary: shape.draftScenarioSummary ?? undefined,
    impactPreviewRequest,
    confirmationsRequired: confirmationsRequired.length ? confirmationsRequired : undefined,
  };
  return Response.json(out);
}

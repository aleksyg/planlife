import OpenAI from "openai";
import type { AiAction, AiResponse } from "@/ai/types";
import type { AiPromptPayload } from "@/ai/promptPayload";

type RequestBody = {
  prompt: string;
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

function getJsonSchema() {
  // JSON Schema for AiResponse with strict enum-based actions.
  return {
    name: "planlife_ai_response",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string" },
            },
            required: ["type"],
            oneOf: [
              {
                properties: {
                  type: { const: "QuitPartnerJobFromYearIndex" },
                  yearIndex: { type: "number" },
                },
                required: ["type", "yearIndex"],
                additionalProperties: false,
              },
              {
                properties: { type: { const: "SetUserBaseAnnual" }, value: { type: "number" } },
                required: ["type", "value"],
                additionalProperties: false,
              },
              {
                properties: {
                  type: { const: "SetPartnerBaseAnnual" },
                  value: { type: "number" },
                },
                required: ["type", "value"],
                additionalProperties: false,
              },
              {
                properties: {
                  type: { const: "SetIncomeGrowthRate" },
                  who: { enum: ["user", "partner"] },
                  value: { type: "number" },
                },
                required: ["type", "who", "value"],
                additionalProperties: false,
              },
              {
                properties: { type: { const: "SetLifestyleMonthly" }, value: { type: "number" } },
                required: ["type", "value"],
                additionalProperties: false,
              },
              {
                properties: {
                  type: { const: "SetHousingMonthlyRent" },
                  value: { type: "number" },
                },
                required: ["type", "value"],
                additionalProperties: false,
              },
              {
                properties: { type: { const: "SetStateTaxRate" }, value: { type: "number" } },
                required: ["type", "value"],
                additionalProperties: false,
              },
              {
                properties: {
                  type: { const: "SetRetirementSplitPct" },
                  who: { enum: ["user", "partner"] },
                  preTaxPct: { type: "number" },
                  rothPct: { type: "number" },
                },
                required: ["type", "who", "preTaxPct", "rothPct"],
                additionalProperties: false,
              },
              {
                properties: {
                  type: { const: "SetEmployerMatch" },
                  who: { enum: ["user", "partner"] },
                  hasMatch: { type: "boolean" },
                  matchPct: { type: "number" },
                  upToPct: { type: "number" },
                },
                required: ["type", "who", "hasMatch"],
                additionalProperties: false,
              },
              {
                properties: {
                  type: { const: "SetPreTaxDeductionsMonthly" },
                  who: { enum: ["user", "partner"] },
                  value: { type: "number" },
                },
                required: ["type", "who", "value"],
                additionalProperties: false,
              },
            ],
          },
        },
        notes: { type: "array", items: { type: "string" } },
      },
      required: ["actions"],
    },
  } as const;
}

function validateActionAgainstBounds(action: AiAction, ctx: AiPromptPayload): string | null {
  const b = ctx.allowedMutations;
  const hasPartner = ctx.currentValues.hasPartner;

  const inRange = (v: number, min: number, max: number) => v >= min && v <= max;
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

  switch (action.type) {
    case "QuitPartnerJobFromYearIndex": {
      if (!hasPartner) return "Cannot quit partner job: baseline has no partner.";
      if (!isNum(action.yearIndex)) return "yearIndex must be a number.";
      if (!inRange(action.yearIndex, b.yearIndex.min, b.yearIndex.max))
        return `yearIndex out of range (${b.yearIndex.min}..${b.yearIndex.max}).`;
      return null;
    }
    case "SetUserBaseAnnual":
    case "SetPartnerBaseAnnual": {
      if (action.type === "SetPartnerBaseAnnual" && !hasPartner)
        return "Cannot set partner income: baseline has no partner.";
      if (!isNum(action.value)) return "value must be a number.";
      if (!inRange(action.value, b.dollars.min, b.dollars.max))
        return `value out of range (${b.dollars.min}..${b.dollars.max}).`;
      return null;
    }
    case "SetIncomeGrowthRate": {
      if (action.who === "partner" && !hasPartner)
        return "Cannot set partner growth rate: baseline has no partner.";
      if (!isNum(action.value)) return "value must be a number.";
      if (!inRange(action.value, b.growthRate.min, b.growthRate.max))
        return `growthRate out of range (${b.growthRate.min}..${b.growthRate.max}).`;
      return null;
    }
    case "SetLifestyleMonthly":
    case "SetHousingMonthlyRent": {
      if (!isNum(action.value)) return "value must be a number.";
      if (!inRange(action.value, b.monthlyDollars.min, b.monthlyDollars.max))
        return `monthly value out of range (${b.monthlyDollars.min}..${b.monthlyDollars.max}).`;
      return null;
    }
    case "SetStateTaxRate": {
      if (!isNum(action.value)) return "value must be a number.";
      if (!inRange(action.value, b.rate.min, b.rate.max))
        return `stateTaxRate out of range (${b.rate.min}..${b.rate.max}).`;
      return null;
    }
    case "SetRetirementSplitPct": {
      if (action.who === "partner" && !hasPartner)
        return "Cannot set partner retirement split: baseline has no partner.";
      if (!isNum(action.preTaxPct) || !isNum(action.rothPct))
        return "preTaxPct and rothPct must be numbers.";
      if (!inRange(action.preTaxPct, b.pct.min, b.pct.max))
        return `preTaxPct out of range (${b.pct.min}..${b.pct.max}).`;
      if (!inRange(action.rothPct, b.pct.min, b.pct.max))
        return `rothPct out of range (${b.pct.min}..${b.pct.max}).`;
      if (action.preTaxPct + action.rothPct > 100) return "preTaxPct + rothPct must be <= 100.";
      return null;
    }
    case "SetEmployerMatch": {
      if (action.who === "partner" && !hasPartner)
        return "Cannot set partner employer match: baseline has no partner.";
      if (action.hasMatch) {
        const matchPct = action.matchPct ?? NaN;
        const upToPct = action.upToPct ?? NaN;
        if (!Number.isFinite(matchPct) || !Number.isFinite(upToPct))
          return "matchPct and upToPct are required when hasMatch is true.";
        if (!inRange(matchPct, b.pct.min, b.pct.max)) return "matchPct out of range 0..100.";
        if (!inRange(upToPct, b.pct.min, b.pct.max)) return "upToPct out of range 0..100.";
      }
      return null;
    }
    case "SetPreTaxDeductionsMonthly": {
      if (action.who === "partner" && !hasPartner)
        return "Cannot set partner pre-tax deductions: baseline has no partner.";
      if (!isNum(action.value)) return "value must be a number.";
      if (!inRange(action.value, b.monthlyDollars.min, b.monthlyDollars.max))
        return `monthly value out of range (${b.monthlyDollars.min}..${b.monthlyDollars.max}).`;
      return null;
    }
    default:
      return "Unknown action type.";
  }
}

function validateResponseShape(obj: unknown): AiResponse | null {
  if (!isRecord(obj)) return null;
  if (!Array.isArray(obj.actions)) return null;
  // Notes are optional
  return obj as AiResponse;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return badRequest("OPENAI_API_KEY is not set.");

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  if (!body.prompt || typeof body.prompt !== "string") return badRequest("prompt is required.");
  if (!body.context) return badRequest("context is required.");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const system = [
    "You are Planlife AI. Convert the user prompt into a small list of structured actions.",
    "Return JSON only and conform to the provided JSON Schema.",
    "Only propose actions from the allowed set and keep values within the provided bounds.",
    "Do not invent projection numbers; do not do financial math beyond choosing actions/values.",
    "If the prompt is ambiguous or missing required details, return actions: [] and put questions in notes.",
  ].join("\n");

  const user = {
    prompt: body.prompt,
    context: body.context,
  };

  let rawText: string | undefined;
  try {
    const params: any = {
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(user) }] },
      ],
      response_format: { type: "json_schema", json_schema: getJsonSchema() },
    };
    const resp = await (client.responses as any).create(params);
    rawText = (resp as any).output_text as string | undefined;
    if (!rawText) {
      // Fallback extraction
      const out = (resp as any).output?.[0]?.content?.[0]?.text;
      if (typeof out === "string") rawText = out;
    }
  } catch (err: any) {
    return badRequest("OpenAI request failed.", { message: err?.message ?? String(err) });
  }

  if (!rawText) return badRequest("OpenAI returned no text output.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return badRequest("OpenAI output was not valid JSON.", { rawText });
  }

  const shape = validateResponseShape(parsed);
  if (!shape) return badRequest("OpenAI output did not match expected shape.", { parsed });

  // Validate each action against bounds.
  const errors: string[] = [];
  const actions: AiAction[] = [];
  for (const a of shape.actions) {
    const action = a as AiAction;
    const e = validateActionAgainstBounds(action, body.context);
    if (e) errors.push(`${action.type}: ${e}`);
    else actions.push(action);
  }

  if (errors.length > 0) {
    const out: AiResponse = {
      actions: [],
      notes: [...(shape.notes ?? []), ...errors],
    };
    return Response.json(out);
  }

  const out: AiResponse = { actions, notes: shape.notes };
  return Response.json(out);
}


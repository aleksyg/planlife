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

function inferQuitYearIndexFromPrompt(prompt: string): number | null {
  // We treat yearIndex as zero-based:
  // - Year 0 = first projection year ("this year", startAge)
  // - "in/after N years" or "after N more years" => yearIndex = N
  const p = prompt.toLowerCase();
  const m =
    p.match(/\bafter\s+(\d+)\s+(more\s+)?years?\b/) ??
    p.match(/\bin\s+(\d+)\s+years?\b/) ??
    p.match(/\bafter\s+(\d+)\s+(more\s+)?yrs?\b/) ??
    p.match(/\bin\s+(\d+)\s+yrs?\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseDollarAmount(s: string): number | null {
  // Supports: $15000, 15,000, 15k, 1.5m
  const cleaned = s.replace(/[, ]/g, "").trim().toLowerCase();
  const m = cleaned.match(/^\$?(\d+(\.\d+)?)(k|m)?$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = m[3];
  const mult = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1;
  return base * mult;
}

function inferRentAndIncomeThreshold(prompt: string): { rentMonthly: number; incomeThresholdAnnual: number } | null {
  const p = prompt.toLowerCase();

  const firstGroup = (patterns: RegExp[]): string | null => {
    for (const re of patterns) {
      const m = p.match(re);
      const g1 = m?.[1];
      if (g1) return g1;
    }
    return null;
  };

  // Rent: "rent to 15k", "increase our rent to $15000", "spend $15000 a month in rent", etc.
  const rentPatterns: RegExp[] = [
    /\brent\s+to\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\b/,
    /\bincrease\s+(?:our\s+)?rent\s+to\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\b/,
    /\bset\s+rent\s+to\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\b/,
    /\brent\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\b/,
    /\bspend\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\s+(?:a\s+)?month\s+in\s+rent\b/,
    /\bspend\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\s*\/\s*mo\s+in\s+rent\b/,
  ];
  const rentRaw = firstGroup(rentPatterns);
  if (!rentRaw) return null;
  const rentMonthly = parseDollarAmount(rentRaw);
  if (!rentMonthly || rentMonthly <= 0) return null;

  // Threshold: "once income hits $1.5m", "when household income reaches 1500000",
  // "once household income is greater than $1.5m", "income > $1.5m", etc.
  const thresholdPatterns: RegExp[] = [
    /\b(?:once|when)\s+(?:our\s+)?(?:household\s+)?income\s+(?:hits|reaches|exceeds)\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\b/,
    /\b(?:once|when)\s+(?:our\s+)?(?:household\s+)?income\s+is\s+(?:over|above|greater\s+than|>=)\s+\$?([\d.,]+(?:\.\d+)?\s*[km]?)\b/,
    /\b(?:once|when)\s+(?:our\s+)?(?:household\s+)?income\s*(?:>|>=)\s*\$?([\d.,]+(?:\.\d+)?\s*[km]?)\b/,
  ];
  const thresholdRaw = firstGroup(thresholdPatterns);
  if (!thresholdRaw) return null;
  const incomeThresholdAnnual = parseDollarAmount(thresholdRaw);
  if (!incomeThresholdAnnual || incomeThresholdAnnual <= 0) return null;

  return { rentMonthly, incomeThresholdAnnual };
}

function firstYearIndexMeetingIncomeThreshold(grossIncomeByYear: readonly number[], thresholdAnnual: number): number | null {
  const i = grossIncomeByYear.findIndex((x) => x >= thresholdAnnual);
  return i >= 0 ? i : null;
}

function getJsonSchema() {
  // JSON Schema for AiResponse with strict enum-based actions.
  // Used as Responses API `text.format` payload.
  //
  // Note: OpenAI Structured Outputs supports a restricted JSON Schema subset.
  // In particular, `oneOf` is rejected, and in `strict: true` mode OpenAI
  // requires `required` to include *every* key in `properties`.
  // To model optional fields, we make them nullable and require them all.
  // Per-action requirements are enforced server-side.
  return {
    type: "json_schema",
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
              type: {
                enum: [
                  "QuitPartnerJobFromYearIndex",
                  "SetUserBaseAnnual",
                  "SetPartnerBaseAnnual",
                  "SetIncomeGrowthRate",
                  "SetLifestyleMonthly",
                  "SetHousingMonthlyRent",
                  "SetHousingMonthlyRentFromYearIndex",
                  "SetStateTaxRate",
                  "SetRetirementSplitPct",
                  "SetEmployerMatch",
                  "SetPreTaxDeductionsMonthly",
                ],
              },
              yearIndex: { type: ["number", "null"] },
              who: { enum: ["user", "partner", null] },
              value: { type: ["number", "null"] },
              preTaxPct: { type: ["number", "null"] },
              rothPct: { type: ["number", "null"] },
              hasMatch: { type: ["boolean", "null"] },
              matchPct: { type: ["number", "null"] },
              upToPct: { type: ["number", "null"] },
            },
            required: [
              "type",
              "yearIndex",
              "who",
              "value",
              "preTaxPct",
              "rothPct",
              "hasMatch",
              "matchPct",
              "upToPct",
            ],
          },
        },
        notes: { type: ["array", "null"], items: { type: "string" } },
      },
      required: ["actions", "notes"],
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
    case "SetHousingMonthlyRentFromYearIndex": {
      if (!isNum(action.yearIndex)) return "yearIndex must be a number.";
      if (!inRange(action.yearIndex, b.yearIndex.min, b.yearIndex.max))
        return `yearIndex out of range (${b.yearIndex.min}..${b.yearIndex.max}).`;
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
  const requestedModel = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";
  // Structured outputs with json_schema require supported model snapshots.
  const model =
    requestedModel === "gpt-4o"
      ? "gpt-4o-2024-08-06"
      : requestedModel === "gpt-4o-mini"
        ? "gpt-4o-mini-2024-07-18"
        : requestedModel;

  const system = [
    "You are Planlife AI. Convert the user prompt into a small list of structured actions.",
    "Return JSON only and conform to the provided JSON Schema.",
    "Only propose actions from the allowed set and keep values within the provided bounds.",
    "Do not invent projection numbers; do not do financial math beyond choosing actions/values.",
    "If the prompt is ambiguous or missing required details, return actions: [] and put questions in notes.",
    "Important: yearIndex is zero-based (Year 0 is the first projection year / current year). If user says 'in/after N years' interpret as yearIndex=N.",
    "If the prompt is conditional on reaching an income threshold (e.g. 'once household income hits $X'), do not guess; prefer returning actions: [] with notes unless you can map it to a specific yearIndex.",
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
      text: { format: getJsonSchema() },
    };
    const resp = await (client.responses as any).create(params);
    rawText = (resp as any).output_text as string | undefined;
    if (!rawText) {
      // Fallback extraction
      const out = (resp as any).output?.[0]?.content?.[0]?.text;
      if (typeof out === "string") rawText = out;
    }
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    const message =
      err?.error?.message ??
      err?.response?.data?.error?.message ??
      err?.message ??
      String(err);
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

  const shape = validateResponseShape(parsed);
  if (!shape) return badRequest("OpenAI output did not match expected shape.", { parsed });

  // Validate each action against bounds.
  const errors: string[] = [];
  const actions: AiAction[] = [];
  const notes: string[] = [...(shape.notes ?? [])];
  const inferredQuitYearIndex = inferQuitYearIndexFromPrompt(body.prompt);
  const inferredRentThreshold = inferRentAndIncomeThreshold(body.prompt);
  const modelActions = Array.isArray(shape.actions) ? (shape.actions as unknown[]) : [];

  // If prompt is conditional on income threshold for rent, deterministically convert to a specific yearIndex.
  let derivedRentAction: AiAction | null = null;
  if (inferredRentThreshold) {
    const gross = body.context.series?.grossIncomeByYear ?? [];
    const yearIndex = firstYearIndexMeetingIncomeThreshold(gross, inferredRentThreshold.incomeThresholdAnnual);
    if (yearIndex == null) {
      const out: AiResponse = {
        actions: [],
        notes: [
          ...notes,
          `Baseline household gross income never reaches ${inferredRentThreshold.incomeThresholdAnnual.toLocaleString(
            "en-US",
            { style: "currency", currency: "USD", maximumFractionDigits: 0 },
          )} during the projection, so I can’t map this condition to a specific year.`,
        ],
      };
      return Response.json(out);
    }

    derivedRentAction = {
      type: "SetHousingMonthlyRentFromYearIndex",
      yearIndex,
      value: inferredRentThreshold.rentMonthly,
    };
    notes.push(
      `Mapped income threshold condition to Year ${yearIndex} because baseline gross income first reaches ${inferredRentThreshold.incomeThresholdAnnual.toLocaleString(
        "en-US",
        { style: "currency", currency: "USD", maximumFractionDigits: 0 },
      )} in that year.`,
    );
  }

  // Filter model-proposed rent actions if we derived a deterministic conditional-rent action.
  const actionsToProcess = derivedRentAction
    ? [
        ...modelActions.filter(
          (a) =>
            isRecord(a) &&
            a.type !== "SetHousingMonthlyRent" &&
            a.type !== "SetHousingMonthlyRentFromYearIndex",
        ),
        derivedRentAction,
      ]
    : modelActions;

  for (const a of actionsToProcess) {
    const action = a as AiAction;

    if (action.type === "QuitPartnerJobFromYearIndex" && inferredQuitYearIndex != null) {
      // Deterministic post-processing: prefer explicit "in/after N years" mapping.
      (action as any).yearIndex = inferredQuitYearIndex;
      notes.push(
        `Interpreted "${body.prompt}" as quit starting Year ${inferredQuitYearIndex} (yearIndex=${inferredQuitYearIndex}, where Year 0 is the first projection year).`,
      );
    }

    const e = validateActionAgainstBounds(action, body.context);
    if (e) errors.push(`${action.type}: ${e}`);
    else actions.push(action);
  }

  if (errors.length > 0) {
    const out: AiResponse = {
      actions: [],
      notes: [...notes, ...errors],
    };
    return Response.json(out);
  }

  const out: AiResponse = { actions, notes: notes.length ? notes : undefined };
  return Response.json(out);
}


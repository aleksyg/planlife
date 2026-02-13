import OpenAI from "openai";
import type { AiChatMessage, AiPlannerResponse, AiScenarioPatch } from "@/ai/types";
import type { AiPromptPayload } from "@/ai/promptPayload";
import { getLastUserText, promptMentionsPartner } from "@/ai/compiler/promptFacts";
import { computeConfirmationsRequired, isPartnerPatch } from "@/ai/compiler/confirmations";
import { firstYearIndexMeetingThreshold, inferThresholdTriggerFromText } from "@/ai/compiler/thresholdTriggers";

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

function getJsonSchema() {
  // JSON Schema for AiPlannerResponse (clarify/propose).
  // Used as Responses API `text.format` payload.
  // OpenAI Structured Outputs supports a restricted JSON Schema subset:
  // - no oneOf
  // - strict mode requires all properties to be required (nullable for optional)
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
        patches: {
          type: ["array", "null"],
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                enum: [
                  "SetIncomeRange",
                  "SetExpenseRange",
                  "SetContribRange",
                  "SetRatesRange",
                  "AddOneTimeEvent",
                ],
              },
              yearIndex: { type: ["number", "null"] },
              startYearIndex: { type: ["number", "null"] },
              endYearIndexInclusive: { type: ["number", "null"] },
              who: { enum: ["user", "partner", null] },
              kind: { enum: ["lifestyle", "housingRent", "housingPITI", null] },
              baseAnnual: { type: ["number", "null"] },
              monthly: { type: ["number", "null"] },
              employeePreTaxPct: { type: ["number", "null"] },
              employeeRothPct: { type: ["number", "null"] },
              preTaxDeductionsMonthly: { type: ["number", "null"] },
              returnRate: { type: ["number", "null"] },
              inflationRate: { type: ["number", "null"] },
              cashRate: { type: ["number", "null"] },
              stateTaxRate: { type: ["number", "null"] },
              amount: { type: ["number", "null"] },
              label: { type: ["string", "null"] },
              fromBucket: { enum: ["cash", "brokerage", null] },
            },
            required: [
              "type",
              "yearIndex",
              "startYearIndex",
              "endYearIndexInclusive",
              "who",
              "kind",
              "baseAnnual",
              "monthly",
              "employeePreTaxPct",
              "employeeRothPct",
              "preTaxDeductionsMonthly",
              "returnRate",
              "inflationRate",
              "cashRate",
              "stateTaxRate",
              "amount",
              "label",
              "fromBucket",
            ],
          },
        },
      },
      required: [
        "mode",
        "questions",
        "assumptions",
        "draftScenarioSummary",
        "impactPreviewRequest",
        "patches",
      ],
    },
  } as const;
}

function validateAndNormalizePatchAgainstBounds(
  obj: unknown,
  ctx: AiPromptPayload,
): { patch: AiScenarioPatch | null; error: string | null } {
  const b = ctx.allowedMutations;
  const hasPartner = ctx.currentValues.hasPartner;

  const inRange = (v: number, min: number, max: number) => v >= min && v <= max;
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

  if (!isRecord(obj) || typeof obj["type"] !== "string") {
    return { patch: null, error: "Invalid patch item (expected an object with a string 'type')." };
  }

  const t = obj["type"];
  const yearIndex = obj["yearIndex"];
  const startYearIndex = obj["startYearIndex"];
  const endYearIndexInclusive = obj["endYearIndexInclusive"];
  const who = obj["who"];
  const kind = obj["kind"];

  const endNorm = endYearIndexInclusive === null ? undefined : endYearIndexInclusive;

  const ensureRange = (
    start: unknown,
    end: unknown,
  ): { start: number; end?: number; error: string | null } => {
    if (!isNum(start)) return { start: NaN, error: "startYearIndex must be a number." };
    if (!inRange(start, b.yearIndex.min, b.yearIndex.max))
      return { start, error: `startYearIndex out of range (${b.yearIndex.min}..${b.yearIndex.max}).` };
    if (end === null || end === undefined) return { start, end: undefined, error: null };
    if (!isNum(end)) return { start, error: "endYearIndexInclusive must be a number or null." };
    if (!inRange(end, b.yearIndex.min, b.yearIndex.max))
      return { start, error: `endYearIndexInclusive out of range (${b.yearIndex.min}..${b.yearIndex.max}).` };
    if (end < start) return { start, end, error: "endYearIndexInclusive must be >= startYearIndex." };
    return { start, end, error: null };
  };

  switch (t) {
    case "SetIncomeRange": {
      if (who !== "user" && who !== "partner") return { patch: null, error: "who must be 'user' or 'partner'." };
      if (who === "partner" && !hasPartner)
        return { patch: null, error: "Cannot set partner income: baseline has no partner." };
      const r = ensureRange(startYearIndex, endNorm);
      if (r.error) return { patch: null, error: r.error };
      const baseAnnual = obj["baseAnnual"];
      if (!isNum(baseAnnual)) return { patch: null, error: "baseAnnual must be a number." };
      if (!inRange(baseAnnual, b.dollars.min, b.dollars.max))
        return { patch: null, error: `baseAnnual out of range (${b.dollars.min}..${b.dollars.max}).` };
      return {
        patch: { type: "SetIncomeRange", who, startYearIndex: r.start, endYearIndexInclusive: r.end, baseAnnual },
        error: null,
      };
    }
    case "SetExpenseRange": {
      if (kind !== "lifestyle" && kind !== "housingRent" && kind !== "housingPITI")
        return { patch: null, error: "kind must be 'lifestyle'|'housingRent'|'housingPITI'." };
      const r = ensureRange(startYearIndex, endNorm);
      if (r.error) return { patch: null, error: r.error };
      const monthly = obj["monthly"];
      if (!isNum(monthly)) return { patch: null, error: "monthly must be a number." };
      if (!inRange(monthly, b.monthlyDollars.min, b.monthlyDollars.max))
        return { patch: null, error: `monthly out of range (${b.monthlyDollars.min}..${b.monthlyDollars.max}).` };
      return {
        patch: { type: "SetExpenseRange", kind, startYearIndex: r.start, endYearIndexInclusive: r.end, monthly },
        error: null,
      };
    }
    case "SetContribRange": {
      if (who !== "user" && who !== "partner") return { patch: null, error: "who must be 'user' or 'partner'." };
      if (who === "partner" && !hasPartner)
        return { patch: null, error: "Cannot set partner contributions: baseline has no partner." };
      const r = ensureRange(startYearIndex, endNorm);
      if (r.error) return { patch: null, error: r.error };
      const employeePreTaxPct = obj["employeePreTaxPct"];
      const employeeRothPct = obj["employeeRothPct"];
      const preTaxDeductionsMonthly = obj["preTaxDeductionsMonthly"];
      if (employeePreTaxPct != null && employeePreTaxPct !== null && (!isNum(employeePreTaxPct) || !inRange(employeePreTaxPct, b.pct.min, b.pct.max)))
        return { patch: null, error: "employeePreTaxPct must be a number in 0..100 or null." };
      if (employeeRothPct != null && employeeRothPct !== null && (!isNum(employeeRothPct) || !inRange(employeeRothPct, b.pct.min, b.pct.max)))
        return { patch: null, error: "employeeRothPct must be a number in 0..100 or null." };
      if (isNum(employeePreTaxPct) && isNum(employeeRothPct) && employeePreTaxPct + employeeRothPct > 100)
        return { patch: null, error: "employeePreTaxPct + employeeRothPct must be <= 100." };
      if (preTaxDeductionsMonthly != null && preTaxDeductionsMonthly !== null && (!isNum(preTaxDeductionsMonthly) || !inRange(preTaxDeductionsMonthly, b.monthlyDollars.min, b.monthlyDollars.max)))
        return { patch: null, error: "preTaxDeductionsMonthly must be a number in bounds or null." };
      return {
        patch: {
          type: "SetContribRange",
          who,
          startYearIndex: r.start,
          endYearIndexInclusive: r.end,
          employeePreTaxPct: employeePreTaxPct === null ? undefined : (employeePreTaxPct as number | undefined),
          employeeRothPct: employeeRothPct === null ? undefined : (employeeRothPct as number | undefined),
          preTaxDeductionsMonthly:
            preTaxDeductionsMonthly === null ? undefined : (preTaxDeductionsMonthly as number | undefined),
        },
        error: null,
      };
    }
    case "SetRatesRange": {
      const r = ensureRange(startYearIndex, endNorm);
      if (r.error) return { patch: null, error: r.error };
      const returnRate = obj["returnRate"];
      const inflationRate = obj["inflationRate"];
      const cashRate = obj["cashRate"];
      const stateTaxRate = obj["stateTaxRate"];
      const checkRate = (name: string, v: unknown) => {
        if (v == null || v === null) return null;
        if (!isNum(v) || !inRange(v, b.rate.min, b.rate.max)) return `${name} out of range (${b.rate.min}..${b.rate.max}).`;
        return null;
      };
      const e =
        checkRate("returnRate", returnRate) ??
        checkRate("inflationRate", inflationRate) ??
        checkRate("cashRate", cashRate) ??
        checkRate("stateTaxRate", stateTaxRate);
      if (e) return { patch: null, error: e };
      return {
        patch: {
          type: "SetRatesRange",
          startYearIndex: r.start,
          endYearIndexInclusive: r.end,
          returnRate: returnRate === null ? undefined : (returnRate as number | undefined),
          inflationRate: inflationRate === null ? undefined : (inflationRate as number | undefined),
          cashRate: cashRate === null ? undefined : (cashRate as number | undefined),
          stateTaxRate: stateTaxRate === null ? undefined : (stateTaxRate as number | undefined),
        },
        error: null,
      };
    }
    case "AddOneTimeEvent": {
      if (!isNum(yearIndex)) return { patch: null, error: "yearIndex must be a number." };
      if (!inRange(yearIndex, b.yearIndex.min, b.yearIndex.max))
        return { patch: null, error: `yearIndex out of range (${b.yearIndex.min}..${b.yearIndex.max}).` };
      const amount = obj["amount"];
      if (!isNum(amount)) return { patch: null, error: "amount must be a number." };
      if (!inRange(Math.abs(amount), b.dollars.min, b.dollars.max))
        return { patch: null, error: `amount magnitude out of range (${b.dollars.min}..${b.dollars.max}).` };
      const label = obj["label"];
      if (typeof label !== "string" || label.trim().length === 0)
        return { patch: null, error: "label must be a non-empty string." };
      const fromBucket = obj["fromBucket"];
      if (fromBucket !== null && fromBucket !== undefined && fromBucket !== "cash" && fromBucket !== "brokerage")
        return { patch: null, error: "fromBucket must be 'cash'|'brokerage' or null." };
      return {
        patch: {
          type: "AddOneTimeEvent",
          yearIndex,
          amount,
          label,
          fromBucket: fromBucket === null ? undefined : (fromBucket as "cash" | "brokerage" | undefined),
        },
        error: null,
      };
    }
    default:
      return { patch: null, error: "Unknown patch type." };
  }
}

function validatePlannerShape(obj: unknown): {
  mode: "clarify" | "propose";
  questions: string[] | null;
  assumptions: string[] | null;
  draftScenarioSummary: string | null;
  impactPreviewRequest: { focusYearIndex: number | null } | null;
  patches: unknown[] | null;
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
  const patches = Array.isArray(obj["patches"]) ? (obj["patches"] as unknown[]) : null;
  return { mode, questions, assumptions, draftScenarioSummary, impactPreviewRequest, patches };
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
    "Classify the user message into either mode='clarify' (ask questions, no patches) or mode='propose' (assumptions + patches).",
    "Return JSON only and conform to the provided JSON Schema.",
    "Only propose patches from the allowed set and keep values within bounds.",
    "Never invent projection numbers; all impacts are computed by the engine.",
    "Hard rule: never propose partner mutations unless the user explicitly references partner/wife/husband/spouse.",
    "yearIndex is zero-based: Year 0 is the first projection year (age = startAge + yearIndex).",
    "For time off / sabbatical / grad school: model it as SetIncomeRange(who='user', baseAnnual=0) for the time-off years, then SetIncomeRange(who='user', baseAnnual=returnSalary) when work resumes.",
    "For conditional triggers (e.g. 'once income hits $X'): only propose patches if you can map the trigger to a specific yearIndex using context.series.*; otherwise choose mode='clarify'.",
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
  const thresholdTrigger = inferThresholdTriggerFromText(lastUserText);

  if (shape.mode === "clarify") {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: shape.questions ?? [],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }

  // propose mode
  const proposedPatchesRaw = shape.patches ?? [];
  const errors: string[] = [];
  const patches: AiScenarioPatch[] = [];

  if (proposedPatchesRaw.length === 0) {
    const out: AiPlannerResponse = {
      mode: "clarify",
      questions: ["What change do you want to make (who, amount, and when)? I didn’t receive any actionable scenario patches."],
      assumptions: shape.assumptions ?? [],
    };
    return Response.json(out);
  }

  for (const p of proposedPatchesRaw) {
    const { patch, error } = validateAndNormalizePatchAgainstBounds(p, body.context);
    if (error) errors.push(error);
    else if (patch) patches.push(patch);
  }

  // Hard rule: never mutate partner fields unless partner explicitly referenced.
  const partnerPatches = patches.filter(isPartnerPatch);
  if (partnerPatches.length > 0 && !partnerMentioned) {
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
        "I can’t propose patches yet because some requested changes were out of bounds or incomplete. Can you confirm the intended values (amounts, timing, and who they apply to)?",
      ],
      assumptions: [...(shape.assumptions ?? []), ...errors],
    };
    return Response.json(out);
  }

  // Deterministic trigger mapping: if prompt contains an asset/income threshold, map it to a concrete yearIndex.
  let normalizedPatches = patches;
  if (thresholdTrigger) {
    const series =
      thresholdTrigger.seriesKey === "grossIncomeByYear"
        ? body.context.series.grossIncomeByYear
        : thresholdTrigger.seriesKey === "netWorthByYear"
          ? body.context.series.netWorthByYear
          : body.context.series.brokerageByYear;
    const yearIndex = firstYearIndexMeetingThreshold(series ?? [], thresholdTrigger.threshold);
    if (yearIndex == null) {
      const out: AiPlannerResponse = {
        mode: "clarify",
        questions: [
          `Your baseline projection never reaches ${thresholdTrigger.threshold.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          })} for ${thresholdTrigger.seriesKey.replace("ByYear", "")}. Do you want to trigger this in a specific year instead?`,
        ],
        assumptions: shape.assumptions ?? [],
      };
      return Response.json(out);
    }
    normalizedPatches = normalizedPatches.map((p) =>
      p.type === "AddOneTimeEvent" ? { ...p, yearIndex } : p,
    );
  }

  const confirmationsRequired = computeConfirmationsRequired(normalizedPatches, body.context);
  const impactPreviewRequest =
    shape.impactPreviewRequest && shape.impactPreviewRequest.focusYearIndex != null
      ? { focusYearIndex: shape.impactPreviewRequest.focusYearIndex }
      : undefined;

  const out: AiPlannerResponse = {
    mode: "propose",
    assumptions: shape.assumptions ?? [],
    patches: normalizedPatches,
    draftScenarioSummary: shape.draftScenarioSummary ?? undefined,
    impactPreviewRequest,
    confirmationsRequired: confirmationsRequired.length ? confirmationsRequired : undefined,
  };
  return Response.json(out);
}

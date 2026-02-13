"use client";

import { useMemo, useState } from "react";
import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import type { AiChatMessage, AiPlannerResponse } from "@/ai/types";
import { buildAiPromptPayload } from "@/ai/promptPayload";
import { explainAiProposal } from "@/ai/describeProposal";
import { simulatePlan } from "@/engine";
import { applyScenarioPatches } from "@/scenario/applyPatches";
import { materializeYearInputs } from "@/scenario/materializeYearInputs";
import type { ChatMessage } from "./types";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toAiThread(messages: readonly ChatMessage[]): AiChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function assistantTextFromResponse(resp: AiPlannerResponse): string {
  if (resp.mode === "clarify") {
    const parts: string[] = [];
    parts.push("I need a bit more detail to model that.");
    if (resp.questions?.length) {
      parts.push("\n**Questions**");
      parts.push(resp.questions.map((q) => `- ${q}`).join("\n"));
    }
    if (resp.assumptions?.length) {
      parts.push("\n**Assumptions (so far)**");
      parts.push(resp.assumptions.map((a) => `- ${a}`).join("\n"));
    }
    return parts.join("\n\n").trim();
  }

  // propose
  if (resp.draftScenarioSummary) {
    return `${resp.draftScenarioSummary}\n\nReview the proposal below and apply it when ready.`;
  }
  return "I put together a proposal. Review it below and apply it when ready.";
}

export function usePlannerChat(args: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  onScenarioRowsChange?: (rows: YearRow[] | null) => void;
}) {
  const { baselinePlan, baselineRows, onScenarioRowsChange } = args;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AiPlannerResponse | null>(null);
  const [appliedResponse, setAppliedResponse] = useState<AiPlannerResponse | null>(null);
  const [confirmChecks, setConfirmChecks] = useState<Record<string, boolean>>({});

  const proposePatches = useMemo(() => {
    return response?.mode === "propose" ? response.patches : [];
  }, [response]);

  const confirmationsRequired = useMemo(() => {
    return response?.mode === "propose" ? (response.confirmationsRequired ?? []) : [];
  }, [response]);

  const allConfirmationsChecked =
    confirmationsRequired.length === 0 ||
    confirmationsRequired.every((c) => Boolean(confirmChecks[c]));

  const previewRows = useMemo(() => {
    if (!response || response.mode !== "propose" || proposePatches.length === 0) return null;
    try {
      const overrides = applyScenarioPatches({}, proposePatches);
      const yearInputs = materializeYearInputs(baselinePlan, overrides);
      return simulatePlan(baselinePlan, { yearInputs });
    } catch {
      return null;
    }
  }, [baselinePlan, proposePatches, response]);

  const explanation = useMemo(() => {
    if (!response || response.mode !== "propose" || proposePatches.length === 0) return null;
    if (!previewRows) return null;
    try {
      return explainAiProposal({
        baselinePlan,
        baselineRows,
        scenarioRows: previewRows,
        patches: proposePatches,
      });
    } catch {
      return null;
    }
  }, [baselinePlan, baselineRows, previewRows, proposePatches, response]);

  async function send() {
    const userText = composerValue.trim();
    if (!userText) return;

    // Clear immediately on send.
    setComposerValue("");

    const userMsg: ChatMessage = { id: makeId(), role: "user", content: userText };
    const nextMessages = [...messages, userMsg].slice(-24);
    setMessages(nextMessages);

    setLoading(true);
    setError(null);
    setResponse(null);
    setConfirmChecks({});

    try {
      const context = buildAiPromptPayload(baselinePlan, baselineRows as YearRow[]);
      const thread = toAiThread(nextMessages).slice(-12);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: thread, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "AI request failed.");
      const resp = json as AiPlannerResponse;

      setResponse(resp);
      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: assistantTextFromResponse(resp),
      };
      setMessages([...nextMessages, assistantMsg].slice(-24));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", content: `Sorry — I hit an error.\n\n\`${msg}\`` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleConfirm(key: string, checked: boolean) {
    setConfirmChecks((prev) => ({ ...prev, [key]: checked }));
  }

  function apply() {
    if (!response || response.mode !== "propose") return;
    if (!previewRows) return;
    if (!allConfirmationsChecked) return;
    setAppliedResponse(response);
    onScenarioRowsChange?.(previewRows);
  }

  function clearApplied() {
    setAppliedResponse(null);
    onScenarioRowsChange?.(null);
  }

  return {
    messages,
    composerValue,
    setComposerValue,
    loading,
    error,
    response,
    appliedResponse,
    previewRows,
    explanation,
    confirmationsRequired,
    confirmChecks,
    allConfirmationsChecked,
    send,
    toggleConfirm,
    apply,
    clearApplied,
  };
}


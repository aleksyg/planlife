"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import type { AiChatMessage, AiPlannerResponse } from "@/ai/types";
import type { TargetedOverride } from "@/ai/types";
import { buildAiPromptPayload } from "@/ai/promptPayload";
import { explainAiProposal } from "@/ai/describeProposal";
import { simulatePlan } from "@/engine";
import { buildScenarioYearInputsFromOverrides } from "@/rulespec";
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
    if (resp.questions?.length) {
      parts.push(resp.questions.map((q) => `• ${q}`).join("\n"));
    }
    if (resp.assumptions?.length) {
      parts.push("Assumptions so far:\n" + resp.assumptions.map((a) => `• ${a}`).join("\n"));
    }
    return parts.length ? parts.join("\n\n") : "I need a bit more detail to model that.";
  }

  // propose — keep compact; details are in the proposal card
  if (resp.draftScenarioSummary) {
    return resp.draftScenarioSummary;
  }
  return "Proposal ready. Review the card below and save as new change when ready.";
}

export function usePlannerChat(args: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  onScenarioRowsChange?: (rows: YearRow[] | null) => void;
  onDraftChange?: (overrides: TargetedOverride[] | null) => void;
  clearDraftRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const { baselinePlan, baselineRows, onScenarioRowsChange, onDraftChange, clearDraftRef } = args;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AiPlannerResponse | null>(null);
  const [appliedResponse, setAppliedResponse] = useState<AiPlannerResponse | null>(null);
  const [confirmChecks, setConfirmChecks] = useState<Record<string, boolean>>({});

  const proposeOverrides = useMemo(() => {
    return response?.mode === "propose" ? response.overrides : [];
  }, [response]);

  useEffect(() => {
    onDraftChange?.(proposeOverrides.length > 0 ? proposeOverrides : null);
  }, [proposeOverrides, onDraftChange]);

  useEffect(() => {
    if (clearDraftRef) clearDraftRef.current = clearDraft;
  }, [clearDraftRef, clearDraft]);

  const confirmationsRequired = useMemo(() => {
    return response?.mode === "propose" ? (response.confirmationsRequired ?? []) : [];
  }, [response]);

  const allConfirmationsChecked =
    confirmationsRequired.length === 0 ||
    confirmationsRequired.every((c) => Boolean(confirmChecks[c]));

  const previewRows = useMemo(() => {
    if (!response || response.mode !== "propose" || proposeOverrides.length === 0) return null;
    try {
      const yearInputs = buildScenarioYearInputsFromOverrides(baselinePlan, proposeOverrides);
      return simulatePlan(baselinePlan, { yearInputs });
    } catch {
      return null;
    }
  }, [baselinePlan, proposeOverrides, response]);

  const explanation = useMemo(() => {
    if (!response || response.mode !== "propose" || proposeOverrides.length === 0) return null;
    if (!previewRows) return null;
    try {
      return explainAiProposal({
        baselinePlan,
        baselineRows,
        scenarioRows: previewRows,
        overrides: proposeOverrides,
      });
    } catch {
      return null;
    }
  }, [baselinePlan, baselineRows, previewRows, proposeOverrides, response]);

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

  function clearDraft() {
    setResponse(null);
    setConfirmChecks({});
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
    clearDraft,
    draftOverrides: proposeOverrides.length > 0 ? proposeOverrides : null,
  };
}


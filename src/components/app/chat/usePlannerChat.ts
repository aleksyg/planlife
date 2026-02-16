"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import type { AiChatMessage, AiUiResponse, AiHelperResponse } from "@/ai/types";
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

function assistantTextFromResponse(resp: AiUiResponse): string {
  if (resp.mode === "open_helper") {
    return resp.message ?? `Sounds like you want to adjust ${resp.helper}. Open the ${helperLabel(resp.helper)}?`;
  }
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

  // propose — plain English: summary, assumptions, then changes
  const lines: string[] = [];
  if (resp.draftScenarioSummary) {
    lines.push(resp.draftScenarioSummary);
  }
  if (resp.assumptions?.length) {
    lines.push("Assumptions:\n" + resp.assumptions.map((a) => `• ${a}`).join("\n"));
  }
  return lines.length ? lines.join("\n\n") : "Proposal ready. Review below and save as new card when ready.";
}

function helperLabel(helper: AiHelperResponse["helper"]): string {
  switch (helper) {
    case "income": return "Income Editor";
    case "home": return "Home Purchase Editor";
    case "expense": return "Expense Editor";
    case "retirement": return "Retirement Editor";
    case "oneTimeEvent": return "One-Time Event Editor";
    default: return "Editor";
  }
}

export function usePlannerChat(args: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  scenarioRows: readonly YearRow[];
  enabledOverrides: readonly TargetedOverride[];
  onScenarioRowsChange?: (rows: YearRow[] | null) => void;
  onDraftChange?: (overrides: TargetedOverride[] | null) => void;
  clearDraftRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const { baselinePlan, baselineRows, scenarioRows, enabledOverrides, onScenarioRowsChange, onDraftChange, clearDraftRef } = args;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AiUiResponse | null>(null);
  const [appliedResponse, setAppliedResponse] = useState<AiUiResponse | null>(null);
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
      const combined = [...enabledOverrides, ...proposeOverrides];
      const yearInputs = buildScenarioYearInputsFromOverrides(baselinePlan, combined);
      return simulatePlan(baselinePlan, { yearInputs });
    } catch {
      return null;
    }
  }, [baselinePlan, enabledOverrides, proposeOverrides, response]);

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

    // Clear immediately on send. Replace current proposal (new message = fresh proposal).
    setComposerValue("");
    setResponse(null);
    setConfirmChecks({});
    onDraftChange?.(null);

    const userMsg: ChatMessage = { id: makeId(), role: "user", content: userText };
    const nextMessages = [...messages, userMsg].slice(-24);
    setMessages(nextMessages);

    setLoading(true);
    setError(null);

    try {
      // Planner context = scenario only (saved cards). Never include draft; prevents compounding.
      const context = buildAiPromptPayload(
        baselinePlan,
        baselineRows as YearRow[],
        scenarioRows as YearRow[],
        enabledOverrides as TargetedOverride[],
      );
      const thread = toAiThread(nextMessages).slice(-12);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: thread, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "AI request failed.");
      const resp = json as AiUiResponse;

      setResponse(resp);
      const overrides = resp.mode === "propose" ? resp.overrides : [];
      if (overrides.length > 0 && typeof console !== "undefined" && console.log) {
        console.log("[usePlannerChat] proposal shown, overrides:", overrides.length, overrides[0]);
      }
      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: assistantTextFromResponse(resp),
      };
      setMessages([...nextMessages, assistantMsg].slice(-24));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setResponse(null);
      onDraftChange?.(null);
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
    onDraftChange?.(null);
    if (typeof console !== "undefined" && console.log) {
      console.log("[usePlannerChat] draft/proposal cleared");
    }
  }

  /** Clear draft, message history, and composer input. Use after saving a new card so the chat resets to empty. */
  function clearDraftAndResetChat() {
    setResponse(null);
    setConfirmChecks({});
    onDraftChange?.(null);
    setMessages([]);
    setComposerValue("");
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
    clearDraftAndResetChat,
    draftOverrides: proposeOverrides.length > 0 ? proposeOverrides : null,
    pendingHelperOpen:
      response?.mode === "open_helper"
        ? { helper: response.helper, prefill: response.prefill, assumptions: response.assumptions ?? [] }
        : null,
  };
}


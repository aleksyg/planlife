"use client";

import type { MutableRefObject } from "react";
import { useMemo, useState } from "react";
import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import type { ScenarioCard } from "@/scenario/modifiers";
import type { TargetedOverride } from "@/ai/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatComposer } from "./ChatComposer";
import { MessageList } from "./MessageList";
import { ProposalCard } from "./ProposalCard";
import { usePlannerChat } from "./usePlannerChat";

export function ChatPanel(props: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  cards: ScenarioCard[];
  draftOverrides: TargetedOverride[] | null;
  onDraftChange: (overrides: TargetedOverride[] | null) => void;
  onSaveDraft: (overrides: TargetedOverride[], title?: string, summary?: string) => void;
  clearDraftRef?: MutableRefObject<(() => void) | null>;
}) {
  const {
    messages,
    composerValue,
    setComposerValue,
    loading,
    response,
    explanation,
    confirmationsRequired,
    confirmChecks,
    allConfirmationsChecked,
    send,
    toggleConfirm,
    draftOverrides: hookDraftOverrides,
  } = usePlannerChat({
    baselinePlan: props.baselinePlan,
    baselineRows: props.baselineRows,
    onDraftChange: props.onDraftChange,
    clearDraftRef: props.clearDraftRef,
  });

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [scrollSignal, setScrollSignal] = useState(0);

  const proposal = response?.mode === "propose" ? response : null;
  const changes = useMemo(() => explanation?.changes ?? [], [explanation]);

  const handleSaveAsNewChange = () => {
    if (!proposal || (hookDraftOverrides?.length ?? 0) === 0) return;
    props.onSaveDraft(
      hookDraftOverrides ?? [],
      proposal.draftScenarioSummary ?? undefined,
      explanation?.changes?.join(". ") ?? undefined,
    );
  };

  return (
    <div
      className={cn(
        "flex max-h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm",
        "lg:max-h-[calc(100vh-220px)]",
      )}
    >
      <div className="shrink-0 border-b border-border bg-white px-5 py-4">
        <div className="text-sm font-semibold">Planner chat</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Ask a &quot;what if?&quot; Preview below. Save as new change to add a card.
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <MessageList
            messages={messages}
            isTyping={loading}
            onScrollStateChange={setIsAtBottom}
            scrollToBottomSignal={scrollSignal}
            belowMessages={
              proposal ? (
                <ProposalCard
                  response={proposal}
                  changes={changes}
                  confirmationsRequired={confirmationsRequired}
                  confirmChecks={confirmChecks}
                  onToggleConfirm={toggleConfirm}
                  onSaveAsNewChange={handleSaveAsNewChange}
                  saveDisabled={
                    !allConfirmationsChecked || (hookDraftOverrides?.length ?? 0) === 0
                  }
                />
              ) : null
            }
          />
        </div>

        {!isAtBottom ? (
          <div className="pointer-events-none absolute bottom-20 left-0 right-0 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              className="pointer-events-auto h-9 rounded-2xl px-4 text-xs shadow-sm"
              onClick={() => setScrollSignal((s) => s + 1)}
            >
              Jump to latest
            </Button>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-white p-2">
        <ChatComposer
          value={composerValue}
          onChange={setComposerValue}
          onSend={send}
          disabled={loading}
          placeholder='e.g. "What if I take a year off at 35?"'
        />
      </div>
    </div>
  );
}


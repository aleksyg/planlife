"use client";

import { useMemo, useState } from "react";
import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatComposer } from "./ChatComposer";
import { MessageList } from "./MessageList";
import { ProposalCard } from "./ProposalCard";
import { usePlannerChat } from "./usePlannerChat";

export function ChatPanel(props: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  onScenarioRowsChange?: (rows: YearRow[] | null) => void;
}) {
  const {
    messages,
    composerValue,
    setComposerValue,
    loading,
    response,
    appliedResponse,
    explanation,
    confirmationsRequired,
    confirmChecks,
    allConfirmationsChecked,
    send,
    toggleConfirm,
    apply,
    clearApplied,
  } = usePlannerChat(props);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [scrollSignal, setScrollSignal] = useState(0);

  const proposal = response?.mode === "propose" ? response : null;
  const changes = useMemo(() => explanation?.changes ?? [], [explanation]);

  return (
    <div
      className={cn(
        "flex h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm",
        "lg:h-[calc(100vh-220px)]",
      )}
    >
      <div className="border-b border-border bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Planner chat</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Ask a “what if?” and preview the impact before applying.
            </div>
          </div>
          {appliedResponse ? (
            <Button variant="ghost" className="h-8 rounded-2xl px-3 text-xs" onClick={clearApplied}>
              Clear applied
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col">
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
                onApply={apply}
                applyDisabled={!allConfirmationsChecked}
              />
            ) : null
          }
        />

        {!isAtBottom ? (
          <div className="pointer-events-none absolute bottom-24 left-0 right-0 flex justify-center">
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

      <ChatComposer
        value={composerValue}
        onChange={setComposerValue}
        onSend={send}
        disabled={loading}
        placeholder='e.g. “What if I take a year off at 35?”'
      />
    </div>
  );
}


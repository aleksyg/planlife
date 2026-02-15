"use client";

import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import type { TargetedOverride } from "@/ai/types";
import type { ScenarioCard } from "@/scenario/modifiers";
import { ChatPanel } from "@/components/app/chat/ChatPanel";

/**
 * Backwards-compatible export. The chat UI has been refactored into `ChatPanel`.
 * This component remains as a thin wrapper. When used without cards/draft,
 * scenarioRows and enabledOverrides default to baseline and [].
 */
export function AiAssistantPanel(props: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  scenarioRows?: readonly YearRow[];
  enabledOverrides?: readonly TargetedOverride[];
  cards?: ScenarioCard[];
  draftOverrides?: TargetedOverride[] | null;
  onDraftChange?: (overrides: TargetedOverride[] | null) => void;
  onSaveDraft?: (overrides: TargetedOverride[], title?: string, summary?: string) => void;
  clearDraftRef?: React.MutableRefObject<(() => void) | null>;
  onScenarioRowsChange?: (rows: YearRow[] | null) => void;
}) {
  const {
    baselinePlan,
    baselineRows,
    scenarioRows = baselineRows,
    enabledOverrides = [],
    cards = [],
    draftOverrides = null,
    onDraftChange = () => {},
    onSaveDraft = () => {},
    clearDraftRef,
  } = props;
  return (
    <ChatPanel
      baselinePlan={baselinePlan}
      baselineRows={baselineRows}
      scenarioRows={scenarioRows}
      enabledOverrides={enabledOverrides}
      cards={cards}
      draftOverrides={draftOverrides}
      onDraftChange={onDraftChange}
      onSaveDraft={onSaveDraft}
      clearDraftRef={clearDraftRef}
    />
  );
}


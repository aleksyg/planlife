"use client";

import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import { ChatPanel } from "@/components/app/chat/ChatPanel";

/**
 * Backwards-compatible export. The chat UI has been refactored into `ChatPanel`.
 * This component remains as a thin wrapper.
 */
export function AiAssistantPanel(props: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  onScenarioRowsChange?: (rows: YearRow[] | null) => void;
}) {
  return <ChatPanel {...props} />;
}


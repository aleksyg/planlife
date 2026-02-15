"use client";

import { useMemo } from "react";
import type { AiPlannerResponse } from "@/ai/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProposalCard(props: {
  response: Extract<AiPlannerResponse, { mode: "propose" }>;
  changes: string[];
  confirmationsRequired: string[];
  confirmChecks: Record<string, boolean>;
  onToggleConfirm: (key: string, checked: boolean) => void;
  onSaveAsNewChange: () => void;
  onClearDraft?: () => void;
  saveDisabled?: boolean;
  /** When true, hide the CTA buttons (they are rendered by the parent). */
  hideActions?: boolean;
}) {
  const {
    response,
    changes,
    confirmationsRequired,
    confirmChecks,
    onToggleConfirm,
    onSaveAsNewChange,
    onClearDraft,
    saveDisabled,
    hideActions = false,
  } = props;

  const hasAssumptions = (response.assumptions?.length ?? 0) > 0;
  const hasChanges = changes.length > 0;

  const allConfirmationsChecked = useMemo(() => {
    return confirmationsRequired.length === 0 || confirmationsRequired.every((c) => Boolean(confirmChecks[c]));
  }, [confirmChecks, confirmationsRequired]);

  const shortSummary =
    response.draftScenarioSummary ?? (changes.length > 0 ? changes[0] : "Review and save as a scenario card.");

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground line-clamp-2">{shortSummary}</p>

      {confirmationsRequired.length > 0 ? (
        <div className="mt-3 rounded-xl border border-border bg-muted/10 p-3">
          <div className="text-xs font-medium text-muted-foreground">Confirm before saving</div>
          <div className="mt-2 space-y-2 text-sm">
            {confirmationsRequired.map((c) => (
              <label key={c} className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(confirmChecks[c])}
                  onChange={(e) => onToggleConfirm(c, e.target.checked)}
                />
                <span className="text-foreground">{c}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {(hasAssumptions || hasChanges) ? (
        <details className="mt-3 rounded-xl border border-border bg-muted/5 px-4 py-2" open={false}>
          <summary className="cursor-pointer text-sm font-medium">Details</summary>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            {hasAssumptions ? (
              <div>
                <div className="font-medium text-foreground">Assumptions</div>
                <ul className="list-disc space-y-1 pl-5">
                  {(response.assumptions ?? []).map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hasChanges ? (
              <div>
                <div className="font-medium text-foreground">Changes</div>
                <ul className="list-disc space-y-1 pl-5">
                  {changes.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {!hideActions ? (
        <div className="mt-3 flex items-center gap-2">
          <Button
            className="rounded-2xl"
            onClick={onSaveAsNewChange}
            disabled={saveDisabled ?? !allConfirmationsChecked}
          >
            Save as new card
          </Button>
          {onClearDraft ? (
            <Button variant="ghost" size="sm" className="rounded-2xl" onClick={onClearDraft}>
              Clear draft
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


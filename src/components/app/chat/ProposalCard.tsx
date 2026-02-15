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
  saveDisabled?: boolean;
}) {
  const {
    response,
    changes,
    confirmationsRequired,
    confirmChecks,
    onToggleConfirm,
    onSaveAsNewChange,
    saveDisabled,
  } = props;

  const hasAssumptions = (response.assumptions?.length ?? 0) > 0;
  const hasChanges = changes.length > 0;

  const allConfirmationsChecked = useMemo(() => {
    return confirmationsRequired.length === 0 || confirmationsRequired.every((c) => Boolean(confirmChecks[c]));
  }, [confirmChecks, confirmationsRequired]);

  const shortSummary =
    response.draftScenarioSummary ?? (changes.length > 0 ? changes[0] : "Review and save as a scenario card.");

  return (
    <div className="w-full rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Proposal</div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{shortSummary}</p>
        </div>
        <Button
          className="shrink-0 rounded-2xl"
          onClick={onSaveAsNewChange}
          disabled={saveDisabled ?? !allConfirmationsChecked}
        >
          Save as new change
        </Button>
      </div>

        {confirmationsRequired.length ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/10 p-3">
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

        <div className={cn("mt-4 grid gap-3", !hasAssumptions && !hasChanges ? "hidden" : "")}>
          {hasAssumptions ? (
            <details className="rounded-xl border border-border bg-muted/5 px-4 py-3" open={false}>
              <summary className="cursor-pointer text-sm font-medium">Assumptions</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {(response.assumptions ?? []).map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {hasChanges ? (
            <details className="group rounded-xl border border-border bg-muted/5 px-4 py-3" open={false}>
              <summary className="cursor-pointer text-sm font-medium">Changes</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {changes.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
    </div>
  );
}


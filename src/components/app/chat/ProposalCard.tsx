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
  onApply: () => void;
  applyDisabled?: boolean;
}) {
  const { response, changes, confirmationsRequired, confirmChecks, onToggleConfirm, onApply, applyDisabled } = props;

  const hasAssumptions = (response.assumptions?.length ?? 0) > 0;
  const hasChanges = changes.length > 0;

  const allConfirmationsChecked = useMemo(() => {
    return confirmationsRequired.length === 0 || confirmationsRequired.every((c) => Boolean(confirmChecks[c]));
  }, [confirmChecks, confirmationsRequired]);

  return (
    <div className="w-full rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Proposal</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Review assumptions and changes, then apply to preview results.
            </div>
          </div>
          <Button className="rounded-2xl" onClick={onApply} disabled={applyDisabled || !allConfirmationsChecked}>
            Apply
          </Button>
        </div>

        {confirmationsRequired.length ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/10 p-3">
            <div className="text-xs font-medium text-muted-foreground">Confirm before applying</div>
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
            <details className="rounded-xl border border-border bg-muted/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">Assumptions</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {(response.assumptions ?? []).map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {hasChanges ? (
            <details className="rounded-xl border border-border bg-muted/5 px-4 py-3">
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


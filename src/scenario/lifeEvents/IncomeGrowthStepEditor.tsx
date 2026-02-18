"use client";

import type { IncomeGrowthStepMutation, Mutation } from "./types";
import { Input } from "@/components/ui/input";
import { PercentInput } from "@/components/ui/PercentInput";
import { Button } from "@/components/ui/button";
import {
  AGE_W,
  PCT_W,
  MePartnerToggle,
  InlineLabel,
} from "./incomeEditorLayout";

const DEFAULT_AGE = 30;

export type IncomeGrowthStepEditorProps = {
  mutations: Mutation[];
  onChange: (next: Mutation[]) => void;
};

function filterSteps(mutations: Mutation[]): IncomeGrowthStepMutation[] {
  return mutations.filter(
    (m): m is IncomeGrowthStepMutation => m.kind === "income_growth_step",
  );
}

function replaceAt(
  mutations: Mutation[],
  index: number,
  replacement: IncomeGrowthStepMutation,
): Mutation[] {
  const list = filterSteps(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  const next = [...mutations];
  next[globalIdx] = replacement;
  return next;
}

function removeAt(mutations: Mutation[], index: number): Mutation[] {
  const list = filterSteps(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  return mutations.filter((_, i) => i !== globalIdx);
}

export function IncomeGrowthStepEditor({
  mutations,
  onChange,
}: IncomeGrowthStepEditorProps) {
  const list = filterSteps(mutations);

  const addEntry = () => {
    const m: IncomeGrowthStepMutation = {
      kind: "income_growth_step",
      appliesTo: "user",
      age: DEFAULT_AGE,
      growthPct: 0,
    };
    onChange([...mutations, m]);
  };

  if (list.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground">
        Income growth changes
      </div>
      {list.map((m, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-muted/10 p-3"
        >
          <div className="flex items-center justify-between">
            <span />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
              onClick={() => onChange(removeAt(mutations, i))}
            >
              Remove
            </button>
          </div>
          {/* Single row: Me/Partner | From age | Growth % */}
          <div className="flex items-center gap-2 flex-nowrap mt-2">
            <MePartnerToggle
              value={m.appliesTo ?? "user"}
              onChange={(appliesTo) =>
                onChange(replaceAt(mutations, i, { ...m, appliesTo }))
              }
            />
            <InlineLabel>From age</InlineLabel>
            <div className={AGE_W}>
              <Input
                type="number"
                min={0}
                max={120}
                className="h-8 w-full"
                value={m.age}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isFinite(v)) return;
                  onChange(replaceAt(mutations, i, { ...m, age: v }));
                }}
              />
            </div>
            <InlineLabel>Growth %</InlineLabel>
            <div className={PCT_W}>
              <PercentInput
                value={m.growthPct}
                onChange={(growthPct) =>
                  onChange(
                    replaceAt(mutations, i, {
                      ...m,
                      growthPct: growthPct ?? 0,
                    }),
                  )
                }
                placeholder="—"
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addEntry}>
        Add another growth change
      </Button>
    </div>
  );
}

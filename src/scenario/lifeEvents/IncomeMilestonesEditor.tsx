"use client";

import type { IncomeMilestoneMutation, Mutation } from "./types";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Button } from "@/components/ui/button";
import { MePartnerToggle, InlineLabel } from "./incomeEditorLayout";

const DEFAULT_AGE = 30;

export type IncomeMilestonesEditorProps = {
  mutations: Mutation[];
  onChange: (next: Mutation[]) => void;
};

function filterMilestones(mutations: Mutation[]): IncomeMilestoneMutation[] {
  return mutations.filter(
    (m): m is IncomeMilestoneMutation => m.kind === "income_milestone",
  );
}

function replaceAt(
  mutations: Mutation[],
  index: number,
  replacement: IncomeMilestoneMutation,
): Mutation[] {
  const list = filterMilestones(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  const next = [...mutations];
  next[globalIdx] = replacement;
  return next;
}

function removeAt(mutations: Mutation[], index: number): Mutation[] {
  const list = filterMilestones(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  return mutations.filter((_, i) => i !== globalIdx);
}

export function IncomeMilestonesEditor({
  mutations,
  onChange,
}: IncomeMilestonesEditorProps) {
  const list = filterMilestones(mutations);

  const addEntry = () => {
    const m: IncomeMilestoneMutation = {
      kind: "income_milestone",
      appliesTo: "user",
      age: DEFAULT_AGE,
      baseAnnual: null,
      bonusAnnual: null,
      growthPct: null,
    };
    onChange([...mutations, m]);
  };

  if (list.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground">
        Income milestones
      </div>
      {list.map((m, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-muted/10 p-3 space-y-3"
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
          {/* Two rows, 6 cols: label | box | label | box | label | box. Words align vertically, all boxes 6rem. */}
          <div
            className="grid items-center gap-x-3 gap-y-2"
            style={{
              gridTemplateColumns: "auto 6rem auto 6rem auto 6rem",
            }}
          >
            {/* Row 1: Me/Partner (col1), Age (col3), Age input (col4) */}
            <div style={{ gridRow: 1, gridColumn: 1 }}>
              <MePartnerToggle
                value={m.appliesTo ?? "user"}
                onChange={(appliesTo) =>
                  onChange(replaceAt(mutations, i, { ...m, appliesTo }))
                }
              />
            </div>
            <div style={{ gridRow: 1, gridColumn: 3 }}>
              <InlineLabel>Age</InlineLabel>
            </div>
            <div style={{ gridRow: 1, gridColumn: 4 }} className="min-w-24">
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
            {/* Row 2: Base (col1), Base input (col2), Bonus (col3), Bonus input (col4), Growth % (col5), Growth input (col6) */}
            <div style={{ gridRow: 2, gridColumn: 1 }}>
              <InlineLabel>Base</InlineLabel>
            </div>
            <div style={{ gridRow: 2, gridColumn: 2 }} className="min-w-24">
              <CurrencyInput
                value={m.baseAnnual}
                onChange={(baseAnnual) =>
                  onChange(replaceAt(mutations, i, { ...m, baseAnnual }))
                }
              />
            </div>
            <div style={{ gridRow: 2, gridColumn: 3 }}>
              <InlineLabel>Bonus</InlineLabel>
            </div>
            <div style={{ gridRow: 2, gridColumn: 4 }} className="min-w-24">
              <CurrencyInput
                value={m.bonusAnnual}
                onChange={(bonusAnnual) =>
                  onChange(replaceAt(mutations, i, { ...m, bonusAnnual }))
                }
              />
            </div>
            <div style={{ gridRow: 2, gridColumn: 5 }}>
              <InlineLabel title="Ongoing income growth % effective from this age">
                Growth %
              </InlineLabel>
            </div>
            <div style={{ gridRow: 2, gridColumn: 6 }} className="min-w-24">
              <PercentInput
                value={m.growthPct}
                onChange={(growthPct) =>
                  onChange(replaceAt(mutations, i, { ...m, growthPct }))
                }
                placeholder="—"
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addEntry}>
        Add another milestone
      </Button>
    </div>
  );
}

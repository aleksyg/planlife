"use client";

import type { IncomeCapMutation, Mutation } from "./types";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Button } from "@/components/ui/button";
import {
  AGE_W,
  MONEY_W,
  MePartnerToggle,
  InlineLabel,
} from "./incomeEditorLayout";

const DEFAULT_AGE = 30;

export type IncomeCapEditorProps = {
  mutations: Mutation[];
  onChange: (next: Mutation[]) => void;
};

function filterCaps(mutations: Mutation[]): IncomeCapMutation[] {
  return mutations.filter(
    (m): m is IncomeCapMutation => m.kind === "income_cap_range",
  );
}

function replaceAt(
  mutations: Mutation[],
  index: number,
  replacement: IncomeCapMutation,
): Mutation[] {
  const list = filterCaps(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  const next = [...mutations];
  next[globalIdx] = replacement;
  return next;
}

function removeAt(mutations: Mutation[], index: number): Mutation[] {
  const list = filterCaps(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  return mutations.filter((_, i) => i !== globalIdx);
}

export function IncomeCapEditor({
  mutations,
  onChange,
}: IncomeCapEditorProps) {
  const list = filterCaps(mutations);

  const addEntry = () => {
    const m: IncomeCapMutation = {
      kind: "income_cap_range",
      appliesTo: "user",
      startAge: DEFAULT_AGE,
      endAge: null,
      baseCapAnnual: null,
      bonusCapAnnual: null,
    };
    onChange([...mutations, m]);
  };

  if (list.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground">
        Income caps
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
          {/* Row 1: Me/Partner only */}
          <div>
            <MePartnerToggle
              value={m.appliesTo ?? "user"}
              onChange={(appliesTo) =>
                onChange(replaceAt(mutations, i, { ...m, appliesTo }))
              }
            />
          </div>
          {/* Row 2: 4 columns — Start age | input | End age | input */}
          <div
            className="grid items-center gap-x-2 gap-y-0"
            style={{ gridTemplateColumns: "auto 6rem auto 6rem" }}
          >
            <InlineLabel>Start age</InlineLabel>
            <div className={AGE_W}>
              <Input
                type="number"
                min={0}
                max={120}
                className="h-8 w-full"
                value={m.startAge}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isFinite(v)) return;
                  onChange(replaceAt(mutations, i, { ...m, startAge: v }));
                }}
              />
            </div>
            <InlineLabel title="Blank = through retirement">End age</InlineLabel>
            <div className={AGE_W}>
              <Input
                type="number"
                min={m.startAge}
                max={120}
                className="h-8 w-full"
                value={m.endAge ?? ""}
                placeholder="Retirement"
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw === "" ? null : parseInt(raw, 10);
                  if (v !== null && !Number.isFinite(v)) return;
                  if (v !== null && v < m.startAge) return;
                  onChange(replaceAt(mutations, i, { ...m, endAge: v }));
                }}
              />
            </div>
          </div>
          {/* Row 3: 4 columns — Base cap | input | Bonus cap | input */}
          <div
            className="grid items-center gap-x-2 gap-y-0"
            style={{ gridTemplateColumns: "auto 6rem auto 6rem" }}
          >
            <InlineLabel>Base cap</InlineLabel>
            <div className={MONEY_W}>
              <CurrencyInput
                value={m.baseCapAnnual}
                onChange={(baseCapAnnual) =>
                  onChange(replaceAt(mutations, i, { ...m, baseCapAnnual }))
                }
              />
            </div>
            <InlineLabel>Bonus cap</InlineLabel>
            <div className={MONEY_W}>
              <CurrencyInput
                value={m.bonusCapAnnual}
                onChange={(bonusCapAnnual) =>
                  onChange(replaceAt(mutations, i, { ...m, bonusCapAnnual }))
                }
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addEntry}>
        Add another cap
      </Button>
    </div>
  );
}

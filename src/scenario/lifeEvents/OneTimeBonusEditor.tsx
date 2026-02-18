"use client";

import type { OneTimeBonusMutation, Mutation } from "./types";
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

export type OneTimeBonusEditorProps = {
  mutations: Mutation[];
  onChange: (next: Mutation[]) => void;
};

function filterBonuses(mutations: Mutation[]): OneTimeBonusMutation[] {
  return mutations.filter(
    (m): m is OneTimeBonusMutation => m.kind === "income_one_time_bonus",
  );
}

function replaceAt(
  mutations: Mutation[],
  index: number,
  replacement: OneTimeBonusMutation,
): Mutation[] {
  const list = filterBonuses(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  const next = [...mutations];
  next[globalIdx] = replacement;
  return next;
}

function removeAt(mutations: Mutation[], index: number): Mutation[] {
  const list = filterBonuses(mutations);
  const globalIdx = mutations.indexOf(list[index]);
  if (globalIdx < 0) return mutations;
  return mutations.filter((_, i) => i !== globalIdx);
}

export function OneTimeBonusEditor({
  mutations,
  onChange,
}: OneTimeBonusEditorProps) {
  const list = filterBonuses(mutations);

  const addEntry = () => {
    const m: OneTimeBonusMutation = {
      kind: "income_one_time_bonus",
      appliesTo: "user",
      age: DEFAULT_AGE,
      amount: 0,
    };
    onChange([...mutations, m]);
  };

  if (list.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground">
        One-time bonuses
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
          {/* Single row: Me/Partner | Age | Amount */}
          <div className="flex items-center gap-2 flex-nowrap mt-2">
            <MePartnerToggle
              value={m.appliesTo ?? "user"}
              onChange={(appliesTo) =>
                onChange(replaceAt(mutations, i, { ...m, appliesTo }))
              }
            />
            <InlineLabel>Age</InlineLabel>
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
            <InlineLabel>Amount</InlineLabel>
            <div className={MONEY_W}>
              <CurrencyInput
                value={m.amount}
                onChange={(amount) =>
                  onChange(
                    replaceAt(mutations, i, {
                      ...m,
                      amount: amount ?? 0,
                    }),
                  )
                }
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addEntry}>
        Add another one-time bonus
      </Button>
    </div>
  );
}

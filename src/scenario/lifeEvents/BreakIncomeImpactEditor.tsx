"use client";

import { useState, useEffect } from "react";
import type {
  IncomeAppliesTo,
  IncomeSetRangeMutation,
  IncomeGrowthRangeMutation,
  Mutation,
} from "./types";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Single shared width for all numeric inputs (age, money, %) — ~25% narrower than before */
const INPUT_W = "w-24";
/** Fixed width for inline labels so inputs in each column share the same x-position */
const LABEL_W = "min-w-[7rem] w-28 shrink-0";

/** 3-column track sizes: left labels | left block (label+input) | right block (input). Used by main grid and growth row. */
const GRID_COLS = "140px 14rem 14rem";

const BREAK_DURING_ID = "break:during";
const BREAK_AFTER_ID = "break:after";
const BREAK_AFTER_GROWTH_ID = "break:afterGrowth";
const DEFAULT_START_AGE = 30;

export type BreakIncomeImpactEditorProps = {
  mutations: Mutation[];
  onChange: (next: Mutation[]) => void;
  onRemove?: () => void;
  showRemove?: boolean;
};

function findBreakMutation(
  mutations: Mutation[],
  mutationId: string,
): Mutation | null {
  const m = mutations.find((x) => (x as { mutationId?: string }).mutationId === mutationId);
  return m ?? null;
}

function replaceOrAppend(
  mutations: Mutation[],
  mutationId: string,
  next: Mutation,
): Mutation[] {
  const idx = mutations.findIndex(
    (x) => (x as { mutationId?: string }).mutationId === mutationId,
  );
  if (idx >= 0) {
    return [...mutations.slice(0, idx), next, ...mutations.slice(idx + 1)];
  }
  return [...mutations, next];
}

function removeByMutationId(mutations: Mutation[], mutationId: string): Mutation[] {
  return mutations.filter(
    (x) => (x as { mutationId?: string }).mutationId !== mutationId,
  );
}

// Lightweight hover tooltip: shows on hover/focus of the trigger (info icon).
function InfoTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border bg-muted/50 text-[10px] font-medium text-muted-foreground hover:bg-muted"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        tabIndex={0}
        role="button"
        aria-label={text}
      >
        {children}
      </span>
      {show && (
        <span
          className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md border border-border"
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function BreakIncomeImpactEditor({
  mutations,
  onChange,
  onRemove,
  showRemove = false,
}: BreakIncomeImpactEditorProps) {
  const during = findBreakMutation(mutations, BREAK_DURING_ID) as
    | IncomeSetRangeMutation
    | null;
  const after = findBreakMutation(mutations, BREAK_AFTER_ID) as
    | IncomeSetRangeMutation
    | null;
  const afterGrowth = findBreakMutation(mutations, BREAK_AFTER_GROWTH_ID) as
    | IncomeGrowthRangeMutation
    | null;

  const derivedStart =
    during?.startAge ?? (after ? after.startAge - 2 : DEFAULT_START_AGE);
  const derivedEnd =
    during?.endAge ?? (after ? after.startAge - 1 : DEFAULT_START_AGE + 2);
  const [draftStart, setDraftStart] = useState(derivedStart);
  const [draftEnd, setDraftEnd] = useState(derivedEnd);
  useEffect(() => {
    setDraftStart(derivedStart);
    setDraftEnd(derivedEnd);
  }, [derivedStart, derivedEnd]);

  const breakStartAge = during ? during.startAge : draftStart;
  const breakEndAge =
    during
      ? (during.endAge ?? breakStartAge + 2)
      : after
        ? after.startAge - 1
        : draftEnd;
  const effectiveEndAge = breakEndAge;
  const appliesTo: IncomeAppliesTo =
    during?.appliesTo ?? after?.appliesTo ?? "user";

  // Values: from mutations or defaults. Existence is derived from these.
  const duringBase = during?.baseAnnual ?? 0;
  const duringBonus = during?.bonusAnnual ?? 0;
  const afterBase = after?.baseAnnual ?? null;
  const afterBonus = after?.bonusAnnual ?? null;
  const growthPct =
    afterGrowth?.baseGrowthPct ?? afterGrowth?.bonusGrowthPct ?? null;

  const setAppliesTo = (value: IncomeAppliesTo) => {
    const update = (m: Mutation): Mutation => ({ ...m, appliesTo: value });
    let next = mutations.slice();
    const d = findBreakMutation(next, BREAK_DURING_ID);
    const a = findBreakMutation(next, BREAK_AFTER_ID);
    const g = findBreakMutation(next, BREAK_AFTER_GROWTH_ID);
    if (d) next = next.map((x) => (x === d ? update(x) : x));
    if (a) next = next.map((x) => (x === a ? update(x) : x));
    if (g) next = next.map((x) => (x === g ? update(x) : x));
    onChange(next);
  };

  const upsertDuring = (
    startAge: number,
    endAge: number,
    baseAnnual: number | null,
    bonusAnnual: number | null,
  ) => {
    const m: IncomeSetRangeMutation = {
      mutationId: BREAK_DURING_ID,
      kind: "income_set_range",
      startAge,
      endAge,
      baseAnnual,
      bonusAnnual,
      appliesTo,
    };
    onChange(replaceOrAppend(mutations, BREAK_DURING_ID, m));
  };

  const removeDuring = () => {
    onChange(removeByMutationId(mutations, BREAK_DURING_ID));
  };

  const upsertAfter = (
    endAge: number,
    baseAnnual: number | null,
    bonusAnnual: number | null,
  ) => {
    const m: IncomeSetRangeMutation = {
      mutationId: BREAK_AFTER_ID,
      kind: "income_set_range",
      startAge: endAge + 1,
      endAge: null,
      baseAnnual,
      bonusAnnual,
      appliesTo,
    };
    onChange(replaceOrAppend(mutations, BREAK_AFTER_ID, m));
  };

  const removeAfter = () => {
    let next = removeByMutationId(mutations, BREAK_AFTER_ID);
    next = removeByMutationId(next, BREAK_AFTER_GROWTH_ID);
    onChange(next);
  };

  const upsertAfterGrowth = (endAge: number, pct: number | null) => {
    const m: IncomeGrowthRangeMutation = {
      mutationId: BREAK_AFTER_GROWTH_ID,
      kind: "income_growth_range",
      startAge: endAge + 1,
      endAge: null,
      baseGrowthPct: pct,
      bonusGrowthPct: pct,
      appliesTo,
    };
    onChange(replaceOrAppend(mutations, BREAK_AFTER_GROWTH_ID, m));
  };

  const applyDuringChange = (
    baseAnnual: number | null,
    bonusAnnual: number | null,
  ) => {
    const hasValues = baseAnnual != null || bonusAnnual != null;
    if (!hasValues) {
      removeDuring();
      return;
    }
    upsertDuring(breakStartAge, breakEndAge, baseAnnual, bonusAnnual);
  };

  const applyAfterChange = (
    baseAnnual: number | null,
    bonusAnnual: number | null,
  ) => {
    const hasValues = baseAnnual != null || bonusAnnual != null;
    if (!hasValues) {
      removeAfter();
      return;
    }
    upsertAfter(effectiveEndAge, baseAnnual, bonusAnnual);
  };

  const applyGrowthChange = (pct: number | null) => {
    if (pct == null) {
      onChange(removeByMutationId(mutations, BREAK_AFTER_GROWTH_ID));
      return;
    }
    upsertAfterGrowth(effectiveEndAge, pct);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/10 p-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-foreground">
          Set income for a range of time
        </div>
        {showRemove && onRemove && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
            onClick={onRemove}
          >
            Remove
          </button>
        )}
      </div>

      {/* Main grid: 3 rows only (selector+ages, during, after). Fixed columns — growth row is outside so it doesn't affect widths. */}
      <div
        className="grid gap-x-3 gap-y-3 items-center"
        style={{ gridTemplateColumns: GRID_COLS, minWidth: 0 }}
      >
        {/* Header row: Me/Partner (equal-width segments) inline with Start age + End age */}
        <div className="flex items-center min-h-8">
          <div
            className="inline-flex w-30 rounded-md border border-border overflow-hidden"
            role="group"
            aria-label="Applies to"
          >
            {(["user", "partner"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "flex-1 min-w-0 px-2 py-1.5 text-sm text-center transition-colors",
                  appliesTo === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setAppliesTo(value)}
              >
                {value === "user" ? "Me" : "Partner"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <Label className={cn("text-sm font-medium", LABEL_W)}>Start age</Label>
          <div className={cn(INPUT_W, "shrink-0")}>
            <Input
              type="number"
              min={0}
              max={120}
              className="h-8 w-full"
              value={breakStartAge}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isFinite(v)) return;
                const hasDuring = during != null;
                if (hasDuring) upsertDuring(v, breakEndAge, duringBase, duringBonus);
                else setDraftStart(v);
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          <Label className={cn("text-sm font-medium", LABEL_W)}>End age</Label>
          <div className={cn(INPUT_W, "shrink-0")}>
            <Input
              type="number"
              min={breakStartAge}
              max={120}
              className="h-8 w-full"
              value={breakEndAge}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isFinite(v)) return;
                const hasDuring = during != null;
                if (hasDuring) upsertDuring(breakStartAge, v, duringBase, duringBonus);
                else setDraftEnd(v);
                if (after != null) upsertAfter(v, afterBase, afterBonus);
                if (afterGrowth != null) upsertAfterGrowth(v, growthPct);
              }}
            />
          </div>
        </div>

        {/* Row 2: During break | Base (inline) | Bonus (inline) */}
        <Label className="text-sm font-medium">During break</Label>
        <div className="flex items-center gap-2 min-w-0">
          <Label className={cn("text-sm font-medium", LABEL_W)}>Base</Label>
          <div className={cn(INPUT_W, "shrink-0")}>
            <CurrencyInput
              value={duringBase}
              onChange={(next) => applyDuringChange(next, duringBonus)}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 min-w-0">
          <Label className={cn("text-sm font-medium", LABEL_W)}>Bonus</Label>
          <div className={cn(INPUT_W, "shrink-0")}>
            <CurrencyInput
              value={duringBonus}
              onChange={(next) => applyDuringChange(duringBase, next)}
            />
          </div>
        </div>

        {/* Row 3: After break | Base (inline) | Bonus (inline) */}
        <div className="flex items-center gap-1">
          <Label className="text-sm font-medium">After break</Label>
          <InfoTooltip
            text={`Starts at age ${effectiveEndAge + 1} (End age + 1)`}
          >
            i
          </InfoTooltip>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Label className={cn("text-sm font-medium", LABEL_W)}>Base</Label>
          <div className={cn(INPUT_W, "shrink-0")}>
            <CurrencyInput
              value={afterBase ?? null}
              onChange={(next) => applyAfterChange(next, afterBonus)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 min-w-0">
          <Label className={cn("text-sm font-medium", LABEL_W)}>Bonus</Label>
          <div className={cn(INPUT_W, "shrink-0")}>
            <CurrencyInput
              value={afterBonus ?? null}
              onChange={(next) => applyAfterChange(afterBase, next)}
              placeholder="0"
            />
          </div>
        </div>

      </div>

      {/* Income growth % row: own 3-column grid with same column widths so it doesn't affect main grid. */}
      <div
        className="grid gap-x-3 gap-y-0 items-center mt-3"
        style={{ gridTemplateColumns: GRID_COLS, minWidth: 0 }}
      >
        <div aria-hidden />
        <div className="flex items-center min-w-0">
          <Label
            className="text-sm font-medium cursor-help whitespace-nowrap"
            title="If blank, baseline growth applies"
          >
            Income growth %
          </Label>
        </div>
        <div className="flex items-center justify-end min-w-0">
          <div className={cn(INPUT_W, "shrink-0 ml-auto")}>
            <PercentInput
              value={growthPct}
              onChange={applyGrowthChange}
              placeholder="—"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { IncomeSetRangeMutation } from "./types";
import { formatMoney } from "./summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type IncomeSetRangeRowProps = {
  value: IncomeSetRangeMutation;
  onChange: (next: IncomeSetRangeMutation) => void;
  onDelete: () => void;
  currentBaseAnnual?: number | null;
  currentBonusAnnual?: number | null;
};

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = parseFloat(v.replace(/[,$]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const helperTextClass = "text-xs text-muted-foreground italic";

function helperText(current: number | null | undefined): string {
  if (current == null || !Number.isFinite(current)) return "Unchanged if blank";
  return `Unchanged if blank (currently ${formatMoney(current)})`;
}

export function IncomeSetRangeRow({
  value,
  onChange,
  onDelete,
  currentBaseAnnual,
  currentBonusAnnual,
}: IncomeSetRangeRowProps) {
  const throughRetirement = value.endAge === null;
  const startAgeInvalid = value.startAge < 0 || !Number.isInteger(value.startAge);
  const endAgeInvalid =
    value.endAge !== null &&
    (value.endAge < value.startAge || !Number.isInteger(value.endAge));

  const setStartAge = (v: number) => onChange({ ...value, startAge: v });
  const setEndAge = (v: number | null) => onChange({ ...value, endAge: v });
  const setBaseAnnual = (v: number | null) =>
    onChange({ ...value, baseAnnual: v });
  const setBonusAnnual = (v: number | null) =>
    onChange({ ...value, bonusAnnual: v });

  const handleThroughRetirementChange = (checked: boolean) => {
    setEndAge(checked ? null : value.startAge + 1);
  };

  const endAgeInputValue = value.endAge === null ? "" : value.endAge;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-end">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          onClick={onDelete}
          aria-label="Remove impact"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="start-age" className="shrink-0 text-xs w-16">
            Start age
          </Label>
          <Input
            id="start-age"
            type="number"
            min={0}
            max={120}
            className={cn("h-8 w-20", startAgeInvalid && "border-destructive")}
            value={value.startAge}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setStartAge(Number.isFinite(v) ? v : 0);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="end-age" className="shrink-0 text-xs w-16">
            End age
          </Label>
          <Input
            id="end-age"
            type="number"
            min={throughRetirement ? undefined : value.startAge}
            max={120}
            className={cn("h-8 w-20", endAgeInvalid && "border-destructive")}
            value={endAgeInputValue}
            placeholder="Blank = retirement"
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === "") {
                setEndAge(null);
                return;
              }
              const n = parseInt(v, 10);
              setEndAge(Number.isFinite(n) ? n : value.startAge);
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pl-0">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={throughRetirement}
            onChange={(e) => handleThroughRetirementChange(e.target.checked)}
          />
          Through retirement
        </label>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="base-annual" className="shrink-0 text-xs">
              Annual base pay
            </Label>
            <Input
              id="base-annual"
              type="number"
              min={0}
              className="h-8"
              value={value.baseAnnual ?? ""}
              placeholder="Unchanged"
              onChange={(e) => setBaseAnnual(parseNum(e.target.value))}
            />
          </div>
          <p className={helperTextClass}>{helperText(currentBaseAnnual)}</p>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="bonus-annual" className="shrink-0 text-xs">
              Annual bonus
            </Label>
            <Input
              id="bonus-annual"
              type="number"
              min={0}
              className="h-8"
              value={value.bonusAnnual ?? ""}
              placeholder="Unchanged"
              onChange={(e) => setBonusAnnual(parseNum(e.target.value))}
            />
          </div>
          <p className={helperTextClass}>{helperText(currentBonusAnnual)}</p>
        </div>
      </div>
      {endAgeInvalid && (
        <p className="text-xs text-destructive">
          End age must be ≥ start age
        </p>
      )}
    </div>
  );
}

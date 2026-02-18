"use client";

import { useMemo, useState } from "react";
import type { YearInputs, YearRow } from "@/engine";
import { cn } from "@/lib/utils";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export type ProjectionBarsProps = {
  rows: readonly YearRow[];
  yearInputs?: readonly YearInputs[];
  heightClassName?: string;
  highlightYearIndex?: number | null;
  onHoverYearIndex?: (yearIndex: number | null) => void;
};

export function ProjectionBars({
  rows,
  yearInputs,
  heightClassName = "h-28",
  highlightYearIndex = null,
  onHoverYearIndex,
}: ProjectionBarsProps) {
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => rows.map((r) => r.endNetWorth), [rows]);
  const max = Math.max(1, ...series.map((x) => Math.max(0, x)));

  const active = hover ?? highlightYearIndex;
  const activeRow = active != null ? rows[active] : null;

  return (
    <div className={cn("relative w-full", heightClassName)}>
      <div className="flex h-full w-full items-end gap-1 rounded-xl bg-muted/20 p-3">
        {rows.map((r, i) => {
          const v = Math.max(0, series[i] ?? 0);
          const pct = (v / max) * 100;
          const isActive = active === i;
          const isHighlight = highlightYearIndex === i;
          return (
            <div
              key={i}
              className={cn(
                "relative flex-1 cursor-pointer rounded-md transition-opacity",
                isActive ? "opacity-100" : "opacity-70 hover:opacity-90",
              )}
              onMouseEnter={() => {
                setHover(i);
                onHoverYearIndex?.(i);
              }}
              onMouseLeave={() => {
                setHover(null);
                onHoverYearIndex?.(null);
              }}
              title={`Year ${r.yearIndex} (age ${r.age})`}
            >
              <div
                className={cn(
                  "w-full rounded-md",
                  isActive || isHighlight ? "bg-indigo-600" : "bg-indigo-300",
                )}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>

      {activeRow ? (
        <div className="pointer-events-none absolute right-4 top-4 w-[240px] rounded-xl border border-border bg-background/95 p-3 shadow-lg">
          <div className="text-xs text-muted-foreground">
            Year {activeRow.yearIndex} · Age {activeRow.age}
          </div>
          {yearInputs && yearInputs[activeRow.yearIndex]?.user?.observedBaseNetPayMonthly != null ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Base cashflow: Observed ({formatCurrency(yearInputs[activeRow.yearIndex]!.user!.observedBaseNetPayMonthly!)}/mo)
            </div>
          ) : (
            yearInputs && (
              <div className="mt-1 text-xs text-muted-foreground">Base cashflow: Modeled</div>
            )
          )}
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
            <div className="text-muted-foreground">Income</div>
            <div className="text-right font-medium">{formatCurrency(activeRow.grossIncome)}</div>
            <div className="text-muted-foreground">Outflow</div>
            <div className="text-right font-medium">
              {formatCurrency(activeRow.totalMonthlyOutflow * 12)}
            </div>
            <div className="text-muted-foreground">Savings</div>
            <div className={cn("text-right font-medium", activeRow.annualSavings < 0 && "text-destructive")}>
              {formatCurrency(activeRow.annualSavings)}
            </div>
            <div className="text-muted-foreground">Net worth</div>
            <div className="text-right font-semibold">{formatCurrency(activeRow.endNetWorth)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


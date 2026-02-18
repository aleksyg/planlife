"use client";

import type { IncomeAppliesTo } from "./types";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Shared input width tokens — match BreakIncomeImpactEditor (w-24). */
export const AGE_W = "w-24";
export const MONEY_W = "w-24";
export const PCT_W = "w-24";

/** Inline label width; use with whitespace-nowrap. */
export const LABEL_W = "w-20 shrink-0";

/** Me/Partner segmented control: fixed width, equal segments, same height as inputs. */
export function MePartnerToggle({
  value,
  onChange,
}: {
  value: IncomeAppliesTo;
  onChange: (v: IncomeAppliesTo) => void;
}) {
  return (
    <div
      className="inline-flex h-8 w-30 rounded-md border border-border overflow-hidden shrink-0"
      role="group"
      aria-label="Applies to"
    >
      {(["user", "partner"] as const).map((v) => (
        <button
          key={v}
          type="button"
          className={cn(
            "flex-1 min-w-0 px-2 py-1.5 text-sm text-center transition-colors",
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(v)}
        >
          {v === "user" ? "Me" : "Partner"}
        </button>
      ))}
    </div>
  );
}

/** Inline label with nowrap; optional title for tooltip. */
export function InlineLabel({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      className={cn("text-sm font-medium whitespace-nowrap", LABEL_W, className)}
      title={title}
    >
      {children}
    </Label>
  );
}

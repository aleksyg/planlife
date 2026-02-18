"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const parsePercent = (raw: string): number | null => {
  const s = raw.trim().replace(/%/g, "");
  if (s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export type PercentInputProps = {
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export const PercentInput = React.forwardRef<HTMLInputElement, PercentInputProps>(
  ({ value, onChange, placeholder = "", disabled, className }, ref) => {
    const displayValue =
      value != null ? String(value) : "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const parsed = parsePercent(raw);
      onChange(parsed);
    };

    return (
      <div className={cn("relative flex items-center", className)}>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 w-full pl-3 pr-6"
          value={displayValue}
          onChange={handleChange}
        />
        <span
          className="pointer-events-none absolute right-3 text-muted-foreground text-sm"
          aria-hidden
        >
          %
        </span>
      </div>
    );
  }
);
PercentInput.displayName = "PercentInput";

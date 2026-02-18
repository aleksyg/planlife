"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const formatCurrency = (n: number): string =>
  Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

const parseCurrency = (raw: string): number | null => {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
};

export type CurrencyInputProps = {
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = "", disabled, className }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const [display, setDisplay] = React.useState(() =>
      value != null ? formatCurrency(value) : ""
    );

    // Sync display from value when not focused (e.g. external change or blur)
    React.useEffect(() => {
      if (!focused) {
        setDisplay(value != null ? formatCurrency(value) : "");
      }
    }, [value, focused]);

    const handleFocus = () => setFocused(true);
    const handleBlur = () => {
      setFocused(false);
      const parsed = parseCurrency(display);
      if (parsed !== null) {
        setDisplay(formatCurrency(parsed));
        onChange(parsed);
      } else {
        setDisplay("");
        onChange(null);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDisplay(raw);
      const parsed = parseCurrency(raw);
      onChange(parsed);
    };

    const inputValue = focused ? display : (value != null ? formatCurrency(value) : "");

    return (
      <div className={cn("relative flex items-center", className)}>
        <span
          className="pointer-events-none absolute left-3 text-muted-foreground text-sm"
          aria-hidden
        >
          $
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 w-full pl-6 pr-3"
          value={inputValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

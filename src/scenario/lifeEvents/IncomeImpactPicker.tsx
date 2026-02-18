"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { incomeImpactOptions, type IncomeImpactKind } from "./impactOptions";

export type IncomeImpactPickerProps = {
  onPick: (kind: IncomeImpactKind) => void;
  buttonLabel?: string;
};

export function IncomeImpactPicker({
  onPick,
  buttonLabel = "Add income impact",
}: IncomeImpactPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handlePick = (kind: IncomeImpactKind) => {
    onPick(kind);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {buttonLabel}
      </Button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-border bg-card shadow-md py-1"
          role="menu"
        >
          {incomeImpactOptions.map((opt) => (
            <div key={opt.key}>
              {opt.enabled ? (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/80 focus:bg-muted/80 focus:outline-none"
                  onClick={() => handlePick(opt.kind)}
                >
                  {opt.label}
                </button>
              ) : (
                <div
                  className="px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  role="menuitem"
                  aria-disabled="true"
                >
                  <span>{opt.label}</span>
                  {opt.description && (
                    <span className="ml-1.5 text-xs italic">
                      {opt.description}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

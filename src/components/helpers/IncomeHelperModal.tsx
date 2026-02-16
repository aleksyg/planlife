"use client";

import { useState, useEffect } from "react";
import type { PlanState } from "@/engine";
import type { IncomeConfig } from "@/scenario/cardConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function pickNum(prefill: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = prefill[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v.replace(/[,$]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export function IncomeHelperModal(props: {
  isOpen: boolean;
  onClose: () => void;
  baselinePlan: PlanState;
  prefill?: Record<string, unknown>;
  existingConfig?: IncomeConfig;
  onSave: (config: IncomeConfig) => void;
}) {
  const { isOpen, onClose, baselinePlan, prefill = {}, existingConfig, onSave } = props;

  const user = baselinePlan.household.user;
  const defaultBase = user.income.baseAnnual;
  const defaultBonus = user.income.hasBonus ? (user.income.bonusAnnual ?? 0) : 0;
  const defaultGrowth = user.income.incomeGrowthRate;
  const defaultStartAge = user.age;

  const [baseAnnual, setBaseAnnual] = useState(defaultBase);
  const [bonusAnnual, setBonusAnnual] = useState(defaultBonus);
  const [growthRate, setGrowthRate] = useState(defaultGrowth);
  const [startAge, setStartAge] = useState(defaultStartAge);
  const [observedBaseNetPayMonthly, setObservedBaseNetPayMonthly] = useState<number | "">("");

  useEffect(() => {
    if (existingConfig) {
      setBaseAnnual(existingConfig.baseAnnual);
      setBonusAnnual(existingConfig.bonusAnnual ?? 0);
      setGrowthRate(existingConfig.growthRate ?? defaultGrowth);
      setStartAge(existingConfig.startAge);
      setObservedBaseNetPayMonthly(
        existingConfig.observedBaseNetPayMonthly ?? "",
      );
    } else if (Object.keys(prefill).length > 0) {
      const base = pickNum(prefill, "baseAnnual", "base", "salary", "baseAnnual");
      const bonus = pickNum(prefill, "bonusAnnual", "bonus");
      const growth = pickNum(prefill, "growthRate", "growth");
      const age = pickNum(prefill, "startAge", "age", "fromAge");
      const observed = pickNum(prefill, "observedNet", "observedNetMonthly", "observedBaseNetPayMonthly");
      if (base != null) setBaseAnnual(base);
      if (bonus != null) setBonusAnnual(bonus);
      if (growth != null) setGrowthRate(growth);
      if (age != null) setStartAge(Math.round(age));
      if (observed != null) setObservedBaseNetPayMonthly(observed);
    } else {
      setBaseAnnual(defaultBase);
      setBonusAnnual(defaultBonus);
      setGrowthRate(defaultGrowth);
      setStartAge(defaultStartAge);
      setObservedBaseNetPayMonthly("");
    }
  }, [isOpen, existingConfig, prefill, defaultBase, defaultBonus, defaultGrowth, defaultStartAge]);

  const handleSave = () => {
    const config: IncomeConfig = {
      type: "income",
      startAge: Math.max(baselinePlan.startAge, Math.min(baselinePlan.endAge, Math.round(startAge))),
      baseAnnual: Math.max(0, Math.round(baseAnnual)),
      bonusAnnual: Math.max(0, Math.round(bonusAnnual)),
    };
    if (growthRate !== defaultGrowth && Number.isFinite(growthRate)) config.growthRate = growthRate;
    const observed =
      observedBaseNetPayMonthly === "" || observedBaseNetPayMonthly == null
        ? undefined
        : Math.max(0, Number(observedBaseNetPayMonthly));
    if (observed !== undefined) config.observedBaseNetPayMonthly = observed;
    onSave(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Income change</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseAnnual">Base salary (annual)</Label>
            <Input
              id="baseAnnual"
              type="number"
              min={0}
              value={baseAnnual}
              onChange={(e) => setBaseAnnual(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bonusAnnual">Bonus (annual, optional)</Label>
            <Input
              id="bonusAnnual"
              type="number"
              min={0}
              value={bonusAnnual}
              onChange={(e) => setBonusAnnual(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="growthRate">Growth rate (e.g. 0.03 for 3%)</Label>
            <Input
              id="growthRate"
              type="number"
              step={0.01}
              min={0}
              max={0.2}
              value={growthRate}
              onChange={(e) => setGrowthRate(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observedBaseNetPayMonthly">
              Observed monthly take-home (base pay only)
            </Label>
            <Input
              id="observedBaseNetPayMonthly"
              type="number"
              min={0}
              placeholder="Optional"
              value={observedBaseNetPayMonthly === "" ? "" : observedBaseNetPayMonthly}
              onChange={(e) => {
                const v = e.target.value;
                setObservedBaseNetPayMonthly(v === "" ? "" : parseFloat(v) || 0);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Optional. What actually hits your bank each month from regular paychecks. Excludes
              bonuses/equity. We&apos;ll use this for cashflow; taxes still estimated from gross
              income.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startAge">Applies starting at age (and continues onward)</Label>
            <Input
              id="startAge"
              type="number"
              min={baselinePlan.startAge}
              max={baselinePlan.endAge}
              value={startAge}
              onChange={(e) => setStartAge(parseInt(e.target.value, 10) || baselinePlan.startAge)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave}>Save</Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

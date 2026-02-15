"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { simulatePlan } from "@/engine";
import type { YearRow } from "@/engine";
import type { TargetedOverride } from "@/ai/types";
import { loadBaselineFromStorage } from "@/app/planStateStorage";
import {
  loadScenarioCards,
  saveScenarioCards,
  createScenarioCard,
} from "@/app/scenarioCardsStorage";
import type { ScenarioCard } from "@/scenario/modifiers";
import { getScenarioYearInputs } from "@/scenario/modifiers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectionBars } from "@/components/app/ProjectionBars";
import { ScenarioCardsList } from "@/components/app/ScenarioCardsList";
import { ChatPanel } from "@/components/app/chat/ChatPanel";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PlanYourLifePage() {
  const plan = loadBaselineFromStorage();
  const [cards, setCards] = useState<ScenarioCard[]>(() => loadScenarioCards());
  const [draftOverrides, setDraftOverrides] = useState<TargetedOverride[] | null>(null);
  const clearDraftRef = useRef<(() => void) | null>(null);

  // Baseline: immutable; never mutated by scenario.
  const rows: YearRow[] = plan ? simulatePlan(plan) : [];
  // Scenario = baseline + enabled modifiers (+ draft last). Rebuilt from scratch every time.
  const scenarioYearInputs = useMemo(
    () => (plan ? getScenarioYearInputs(plan, cards, draftOverrides) : []),
    [plan, cards, draftOverrides],
  );
  // When no active modifiers, scenario equals baseline (use baseline rows). Never leave scenario empty.
  const scenarioRows: YearRow[] =
    plan && scenarioYearInputs.length > 0
      ? simulatePlan(plan, { yearInputs: scenarioYearInputs })
      : rows;
  const currentRows = scenarioRows;
  const hasScenario = cards.some((c) => c.enabled) || (draftOverrides?.length ?? 0) > 0;

  const persistCards = useCallback((next: ScenarioCard[]) => {
    setCards(next);
    saveScenarioCards(next);
  }, []);

  const handleToggleCard = useCallback(
    (id: string, enabled: boolean) => {
      setCards((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, enabled } : c));
        saveScenarioCards(next);
        return next;
      });
    },
    [],
  );

  const handleDeleteCard = useCallback((id: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveScenarioCards(next);
      return next;
    });
  }, []);

  const handleSaveDraft = useCallback(
    (overrides: TargetedOverride[], title?: string, summary?: string) => {
      const card = createScenarioCard({
        title: title?.trim() || "AI change",
        summary: summary?.trim() ?? "",
        overrides,
      });
      setCards((prev) => {
        const next = [...prev, card];
        saveScenarioCards(next);
        return next;
      });
      setDraftOverrides(null);
      clearDraftRef.current?.();
    },
    [],
  );

  if (!plan) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Plan Your Life</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter baseline inputs first.</p>
        <Button asChild className="mt-6 rounded-2xl px-7">
          <Link href="/baseline">Get started</Link>
        </Button>
      </div>
    );
  }

  const lastBase = rows[rows.length - 1];
  const lastScen = scenarioRows.length > 0 ? scenarioRows[scenarioRows.length - 1] : null;
  const delta = lastBase && lastScen ? lastScen.endNetWorth - lastBase.endNetWorth : null;

  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl bg-muted/10 p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Scenario changes</CardTitle>
            <CardDescription>
              Toggle cards on/off. Scenario = baseline + enabled cards (later wins). Draft previews last.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScenarioCardsList
              cards={cards}
              onToggle={handleToggleCard}
              onDelete={handleDeleteCard}
            />
          </CardContent>
        </Card>

        <ChatPanel
          baselinePlan={plan}
          baselineRows={rows}
          cards={cards}
          draftOverrides={draftOverrides}
          onDraftChange={setDraftOverrides}
          onSaveDraft={handleSaveDraft}
          clearDraftRef={clearDraftRef}
        />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Impact summary</CardTitle>
              <CardDescription>Baseline vs current plan (placeholder)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-2 w-full rounded-full bg-muted/30">
                <div className="h-2 w-[70%] rounded-full bg-indigo-600" />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Baseline: Age {plan.startAge}</span>
                <span>Current plan: Age {plan.startAge + Math.max(0, rows.length - 1)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Income by year</CardTitle>
              <CardDescription>
                Baseline vs scenario gross income for review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium">Age</th>
                      <th className="px-3 py-2 text-right font-medium">User baseline</th>
                      <th className="px-3 py-2 text-right font-medium">User scenario</th>
                      <th className="px-3 py-2 text-right font-medium">Partner baseline</th>
                      <th className="px-3 py-2 text-right font-medium">Partner scenario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const scen = scenarioRows[i];
                      const userBase = row.userGrossIncome ?? 0;
                      const userScen = scen?.userGrossIncome ?? 0;
                      const userHasDiff = hasScenario && Math.abs(userScen - userBase) > 0.5;
                      const partnerBase = row.partnerGrossIncome ?? 0;
                      const partnerScen = scen?.partnerGrossIncome ?? 0;
                      const partnerHasDiff = hasScenario && Math.abs(partnerScen - partnerBase) > 0.5;
                      return (
                        <tr key={row.yearIndex} className="border-b border-border/70 last:border-0">
                          <td className="px-3 py-1.5">{row.age}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(userBase)}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${userHasDiff ? "font-medium" : ""}`}>
                            {formatCurrency(userScen)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {plan.household.hasPartner ? formatCurrency(partnerBase) : "—"}
                          </td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${partnerHasDiff ? "font-medium" : ""}`}>
                            {plan.household.hasPartner ? formatCurrency(partnerScen) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chart preview</CardTitle>
              <CardDescription>
                Net worth projection ({hasScenario ? "scenario" : "baseline"})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectionBars rows={currentRows} />
              {delta != null ? (
                <div className="mt-3 rounded-xl border border-border bg-muted/10 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Final-age net worth delta</span>
                    <span className={delta < 0 ? "font-semibold text-destructive" : "font-semibold"}>
                      {formatCurrency(delta)}
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


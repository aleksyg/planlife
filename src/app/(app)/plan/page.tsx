"use client";

import Link from "next/link";
import { useState } from "react";
import { simulatePlan } from "@/engine";
import type { YearRow } from "@/engine";
import { loadBaselineFromStorage } from "@/app/planStateStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectionBars } from "@/components/app/ProjectionBars";
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
  const rows: YearRow[] = plan ? simulatePlan(plan) : [];
  const [scenarioRows, setScenarioRows] = useState<YearRow[] | null>(null);
  const currentRows = scenarioRows ?? rows;

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
  const lastScen = scenarioRows ? scenarioRows[scenarioRows.length - 1] : null;
  const delta = lastBase && lastScen ? lastScen.endNetWorth - lastBase.endNetWorth : null;

  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl bg-muted/10 p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Life Decisions</CardTitle>
              <Button variant="outline" size="sm" className="rounded-2xl">
                + Add Decision
              </Button>
            </div>
            <CardDescription>Common scenarios (placeholders for now)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left hover:bg-muted/20">
              <div className="text-sm font-medium">Buy a Home</div>
              <div className="mt-1 text-xs text-muted-foreground">Purchase in 2028 for $650k</div>
            </button>
            <button className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left hover:bg-muted/20">
              <div className="text-sm font-medium">Have a Child</div>
              <div className="mt-1 text-xs text-muted-foreground">Expected in 2026</div>
            </button>
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Explore scenarios
            </div>
          </CardContent>
        </Card>

        <ChatPanel baselinePlan={plan} baselineRows={rows} onScenarioRowsChange={setScenarioRows} />
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
              <CardTitle>Chart preview</CardTitle>
              <CardDescription>
                Net worth projection ({scenarioRows ? "scenario" : "baseline"})
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


"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { simulatePlan } from "@/engine";
import type { YearRow } from "@/engine";
import { loadBaselineFromStorage } from "../planStateStorage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AiResponse } from "@/ai/types";
import { applyAiActions } from "@/ai/applyActions";
import { buildAiPromptPayload } from "@/ai/promptPayload";
import { explainAiProposal } from "@/ai/describeProposal";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** First year index where annualSavings < 0 (simple drawdown proxy). */
function firstNegativeSavingsYear(rows: readonly YearRow[]): number | null {
  const i = rows.findIndex((r) => r.annualSavings < 0);
  return i >= 0 ? i : null;
}

export default function ResultsPage() {
  const [baselinePlan, baselineRows] = useMemo((): [ReturnType<typeof loadBaselineFromStorage>, YearRow[]] => {
    const plan = loadBaselineFromStorage();
    if (!plan) return [null, []];
    const rows = simulatePlan(plan);
    return [plan, rows];
  }, []);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [aiApplied, setAiApplied] = useState<AiResponse | null>(null);

  const [scenarioYearIndex, setScenarioYearIndex] = useState<string>("none");
  const scenarioRows = useMemo(() => {
    if (!baselinePlan || scenarioYearIndex === "none") return null;
    const fromYear = Number(scenarioYearIndex);
    if (Number.isNaN(fromYear) || fromYear < 0) return null;
    return simulatePlan(baselinePlan, {
      partnerZeroIncomeFromYearIndex: fromYear,
    });
  }, [baselinePlan, scenarioYearIndex]);

  const yearCount = baselineRows.length;
  const lastRow = baselineRows[baselineRows.length - 1];
  const firstTenRows = baselineRows.slice(0, 10);
  const firstRow = baselineRows[0];

  const scenarioLastRow = scenarioRows?.[scenarioRows.length - 1];
  const endNetWorthDelta =
    scenarioLastRow != null && lastRow != null
      ? scenarioLastRow.endNetWorth - lastRow.endNetWorth
      : null;
  const retirementProxyBaseline = firstNegativeSavingsYear(baselineRows);
  const retirementProxyScenario = scenarioRows ? firstNegativeSavingsYear(scenarioRows) : null;
  const retirementProxyDelta =
    retirementProxyBaseline != null && retirementProxyScenario != null
      ? (baselinePlan ? baselinePlan.startAge + retirementProxyScenario - (baselinePlan.startAge + retirementProxyBaseline) : null)
      : null;

  const aiPreview = useMemo(() => {
    if (!baselinePlan || !aiResponse || aiResponse.actions.length === 0) return null;
    try {
      const applied = applyAiActions(baselinePlan, aiResponse.actions);
      const rows = simulatePlan(applied.plan, applied.options);
      return { applied, rows };
    } catch (e: any) {
      return { error: e?.message ?? String(e) } as const;
    }
  }, [baselinePlan, aiResponse]);

  const aiExplanation = useMemo(() => {
    if (!baselinePlan || !aiResponse || aiResponse.actions.length === 0) return null;
    if (!aiPreview || !("rows" in aiPreview) || !aiPreview.rows) return null;
    try {
      return explainAiProposal({
        baselinePlan,
        baselineRows,
        scenarioRows: aiPreview.rows,
        actions: aiResponse.actions,
      });
    } catch {
      return null;
    }
  }, [aiPreview, aiResponse, baselinePlan, baselineRows]);

  const aiAppliedRows = useMemo(() => {
    if (!baselinePlan || !aiApplied || aiApplied.actions.length === 0) return null;
    const applied = applyAiActions(baselinePlan, aiApplied.actions);
    return simulatePlan(applied.plan, applied.options);
  }, [baselinePlan, aiApplied]);

  if (!baselinePlan) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <p className="text-muted-foreground">No baseline plan found. Enter your inputs first.</p>
          <Button asChild>
            <Link href="/">Go to baseline inputs</Link>
          </Button>
        </div>
      </div>
    );
  }

  async function handleAiPropose() {
    setAiLoading(true);
    setAiError(null);
    setAiResponse(null);
    try {
      if (!baselinePlan) throw new Error("No baseline plan loaded.");
      const context = buildAiPromptPayload(baselinePlan, baselineRows);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "AI request failed.");
      setAiResponse(json as AiResponse);
    } catch (e: any) {
      setAiError(e?.message ?? String(e));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
            <p className="text-muted-foreground text-sm">Baseline projection</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">Edit inputs</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>End net worth</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(lastRow?.endNetWorth ?? 0)}</p>
              <p className="text-muted-foreground text-xs">Age {lastRow?.age ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>End assets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(lastRow?.endAssetValue ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Retirement contributions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatCurrency(
                  baselineRows.reduce((s, r) => s + r.retirementTotalAnnual, 0)
                )}
              </p>
              <div className="text-muted-foreground mt-2 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>Pre-tax</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      baselineRows.reduce((s, r) => s + r.employeeRetirementPreTaxAnnual, 0)
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Roth</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      baselineRows.reduce((s, r) => s + r.employeeRetirementRothAnnual, 0)
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Employer match</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      baselineRows.reduce((s, r) => s + r.employerMatchAnnual, 0)
                    )}
                  </span>
                </div>
                <p className="pt-1">Over projection</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Taxes (year 0)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(firstRow?.taxesPaid ?? 0)}</p>
              <div className="text-muted-foreground mt-2 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>Federal</span>
                  <span className="tabular-nums">
                    {firstRow != null ? formatCurrency(firstRow.federalIncomeTax) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>State (flat)</span>
                  <span className="tabular-nums">
                    {firstRow != null ? formatCurrency(firstRow.stateIncomeTax) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>FICA</span>
                  <span className="tabular-nums">
                    {firstRow != null ? formatCurrency(firstRow.payrollTax) : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>End debt balance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(lastRow?.totalDebtBalance ?? 0)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AI Assistant (v0)</CardTitle>
            <CardDescription>
              Describe a change in plain English. We’ll preview the structured actions and the impact before applying.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder='e.g. "Set state tax to 6% and quit partner job starting in year 2"'
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleAiPropose}
                disabled={aiLoading || aiPrompt.trim().length === 0}
              >
                {aiLoading ? "Proposing..." : "Propose changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAiPrompt("");
                  setAiError(null);
                  setAiResponse(null);
                }}
              >
                Clear
              </Button>
              {aiResponse?.actions?.length ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAiApplied(aiResponse)}
                >
                  Apply
                </Button>
              ) : null}
              {aiApplied ? (
                <Button type="button" variant="ghost" onClick={() => setAiApplied(null)}>
                  Clear applied
                </Button>
              ) : null}
            </div>

            {aiError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {aiError}
              </div>
            )}

            {aiResponse && (
              <div className="space-y-3">
                {aiResponse.notes?.length ? (
                  <div className="rounded-md border border-border bg-muted/20 px-4 py-2 text-sm">
                    <p className="font-medium">Notes</p>
                    <ul className="mt-1 list-disc pl-5">
                      {aiResponse.notes.map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {aiExplanation ? (
                  <div className="rounded-md border border-border bg-muted/10 p-3 text-sm">
                    <p className="mb-2 font-medium">What this would change</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {aiExplanation.changes.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                    {aiExplanation.implications.length ? (
                      <>
                        <p className="mb-2 mt-4 font-medium">Implications (estimated from the simulation)</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {aiExplanation.implications.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        View proposed actions (JSON)
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/20 p-2 text-xs">
                        {JSON.stringify(aiResponse.actions, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-muted/10 p-3">
                    <p className="mb-2 text-sm font-medium">Proposed actions (JSON)</p>
                    <pre className="max-h-64 overflow-auto text-xs">
                      {JSON.stringify(aiResponse.actions, null, 2)}
                    </pre>
                  </div>
                )}

                {aiPreview && "rows" in aiPreview && aiPreview.rows ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <p className="text-muted-foreground text-sm">
                        Age {lastRow?.age ?? "—"} net worth (preview)
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Baseline</span>
                          <span className="tabular-nums">
                            {lastRow != null ? formatCurrency(lastRow.endNetWorth) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Scenario</span>
                          <span className="tabular-nums">
                            {aiPreview.rows[aiPreview.rows.length - 1] != null
                              ? formatCurrency(aiPreview.rows[aiPreview.rows.length - 1].endNetWorth)
                              : "—"}
                          </span>
                        </div>
                      </div>
                      {lastRow && aiPreview.rows.length ? (
                        <p className="mt-2 text-xl font-semibold">
                          Delta:{" "}
                          {formatCurrency(
                            aiPreview.rows[aiPreview.rows.length - 1].endNetWorth - lastRow.endNetWorth
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : aiPreview && "error" in aiPreview ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {aiPreview.error}
                  </div>
                ) : null}
              </div>
            )}

            {aiAppliedRows ? (
              <div className="rounded-md border border-border bg-muted/10 p-3 text-sm">
                <p className="font-medium">AI scenario applied (this page only)</p>
                <p className="text-muted-foreground text-xs">
                  Baseline in localStorage is unchanged. Clear applied to revert.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Year-by-year</CardTitle>
            <CardDescription>Baseline projection (first 10 years below; full table scrolls)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 text-left font-medium">Age</th>
                    <th className="px-2 py-2 text-right font-medium">Gross income</th>
                    <th className="px-2 py-2 text-right font-medium">Taxes</th>
                    <th className="px-2 py-2 text-right font-medium">Savings</th>
                    <th className="px-2 py-2 text-right font-medium">Retirement contrib.</th>
                    <th className="px-2 py-2 text-right font-medium">Cash</th>
                    <th className="px-2 py-2 text-right font-medium">Retirement (after-tax)</th>
                    <th className="px-2 py-2 text-right font-medium">Retirement (pre-tax)</th>
                    <th className="px-2 py-2 text-right font-medium">Investments (non-retirement)</th>
                    <th className="px-2 py-2 text-right font-medium">Asset total</th>
                    <th className="px-2 py-2 text-right font-medium">End net worth</th>
                    <th className="px-2 py-2 text-right font-medium">Debt balance</th>
                  </tr>
                </thead>
                <tbody>
                  {baselineRows.map((r) => (
                    <tr key={r.yearIndex} className="border-b border-border/50">
                      <td className="px-2 py-1.5">{r.age}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.grossIncome)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.taxesPaid)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.annualSavings)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.retirementTotalAnnual)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.endCashValue)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.endRetirementRothValue)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.endRetirementTaxDeferredValue)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.endBrokerageValue)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.endAssetValue)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.endNetWorth)}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(r.totalDebtBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {baselinePlan.household.hasPartner && (
          <Card>
            <CardHeader>
              <CardTitle>Scenario: Quit partner job</CardTitle>
              <CardDescription>
                Partner income set to zero from selected year. Compare to baseline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={scenarioYearIndex} onValueChange={setScenarioYearIndex}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Starting year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No scenario</SelectItem>
                    {Array.from({ length: yearCount }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        Year {i} (age {baselinePlan.startAge + i})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {scenarioRows != null && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <p className="text-muted-foreground text-sm">
                        Age {lastRow?.age ?? "—"} net worth
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Baseline</span>
                          <span className="tabular-nums">
                            {lastRow != null ? formatCurrency(lastRow.endNetWorth) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Scenario</span>
                          <span className="tabular-nums">
                            {scenarioLastRow != null
                              ? formatCurrency(scenarioLastRow.endNetWorth)
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <p
                        className={`mt-2 ${
                          endNetWorthDelta != null && endNetWorthDelta < 0
                            ? "text-destructive text-xl font-semibold"
                            : "text-xl font-semibold"
                        }`}
                      >
                        {endNetWorthDelta != null
                          ? `Delta: ${endNetWorthDelta >= 0 ? "+" : ""}${formatCurrency(endNetWorthDelta)}`
                          : "—"}
                      </p>
                    </div>
                    {(retirementProxyBaseline != null || retirementProxyScenario != null) && (
                      <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-muted-foreground text-sm">First negative savings (year index)</p>
                        <p className="text-sm">
                          Baseline: year {retirementProxyBaseline ?? "—"} (age{" "}
                          {retirementProxyBaseline != null ? baselinePlan.startAge + retirementProxyBaseline : "—"})
                        </p>
                        <p className="text-sm">
                          Scenario: year {retirementProxyScenario ?? "—"} (age{" "}
                          {retirementProxyScenario != null ? baselinePlan.startAge + retirementProxyScenario : "—"})
                        </p>
                        {retirementProxyDelta != null && (
                          <p className="text-muted-foreground text-xs">
                            Delta: {retirementProxyDelta >= 0 ? "+" : ""}{retirementProxyDelta} years
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-2 text-sm font-medium">
                      Net worth delta vs baseline (first 10 years)
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-2 py-1 text-left font-medium">Year</th>
                            <th className="px-2 py-1 text-right font-medium">Baseline income</th>
                            <th className="px-2 py-1 text-right font-medium">Scenario income</th>
                            <th className="px-2 py-1 text-right font-medium">Baseline net worth</th>
                            <th className="px-2 py-1 text-right font-medium">Scenario net worth</th>
                            <th className="px-2 py-1 text-right font-medium">Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {firstTenRows.map((r) => {
                            const sc = scenarioRows[r.yearIndex];
                            const delta = sc != null ? sc.endNetWorth - r.endNetWorth : null;
                            return (
                              <tr key={r.yearIndex} className="border-b border-border/50">
                                <td className="px-2 py-1">{r.yearIndex}</td>
                                <td className="px-2 py-1 text-right">{formatCurrency(r.grossIncome)}</td>
                                <td className="px-2 py-1 text-right">
                                  {sc != null ? formatCurrency(sc.grossIncome) : "—"}
                                </td>
                                <td className="px-2 py-1 text-right">{formatCurrency(r.endNetWorth)}</td>
                                <td className="px-2 py-1 text-right">
                                  {sc != null ? formatCurrency(sc.endNetWorth) : "—"}
                                </td>
                                <td
                                  className={`px-2 py-1 text-right ${
                                    delta != null && delta < 0 ? "text-destructive" : ""
                                  }`}
                                >
                                  {delta != null ? `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

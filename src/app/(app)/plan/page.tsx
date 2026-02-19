"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { simulatePlan } from "@/engine";
import type { YearRow } from "@/engine";
import type { TargetedOverride } from "@/ai/types";
import { loadBaselineFromStorage } from "@/app/planStateStorage";
import { loadLifeEvents, saveLifeEvents } from "@/app/lifeEventsStorage";
import {
  loadScenarioCards,
  saveScenarioCards,
  createScenarioCard,
  createScenarioCardFromConfig,
} from "@/app/scenarioCardsStorage";
import type { ScenarioCard } from "@/scenario/modifiers";
import { getScenarioYearInputs } from "@/scenario/modifiers";
import { buildOverridesFromCardConfig } from "@/scenario/configToOverrides";
import { buildOverridesFromLifeEvent } from "@/scenario/lifeEvents/toTargetedOverrides";
import type { LifeEvent } from "@/scenario/lifeEvents/types";
import type { IncomeConfig } from "@/scenario/cardConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectionBars } from "@/components/app/ProjectionBars";
import { ScenarioCardsList } from "@/components/app/ScenarioCardsList";
import { LifeEventsPanel } from "@/scenario/LifeEventsPanel";
import { ChatPanel } from "@/components/app/chat/ChatPanel";
import { IncomeHelperModal } from "@/components/helpers/IncomeHelperModal";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const lifeCardId = (id: string) => `life-${id}`;

export default function PlanYourLifePage() {
  const plan = loadBaselineFromStorage();
  const [cards, setCards] = useState<ScenarioCard[]>(() => loadScenarioCards());
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>(() => loadLifeEvents());
  const [draftOverrides, setDraftOverrides] = useState<TargetedOverride[] | null>(null);
  const clearDraftRef = useRef<(() => void) | null>(null);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [incomeModalPrefill, setIncomeModalPrefill] = useState<Record<string, unknown>>({});
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  useEffect(() => {
    saveLifeEvents(lifeEvents);
  }, [lifeEvents]);

  // Sync scenario cards from life events on mount (so stored life events get a card each).
  useEffect(() => {
    if (lifeEvents.length === 0) return;
    const opts = plan ? { minAge: plan.startAge, maxAge: plan.endAge } : undefined;
    setCards((prev) => {
      let next = prev.filter((c) => !c.id.startsWith("life-"));
      for (const evt of lifeEvents) {
        const id = lifeCardId(evt.id);
        const overrides = buildOverridesFromLifeEvent(evt, opts);
        next = next.concat({
          id,
          createdAt: Date.now(),
          title: evt.title || "Life event",
          summary: evt.summary.join(" • "),
          enabled: evt.enabled,
          overrides,
        });
      }
      next.sort((a, b) => a.createdAt - b.createdAt);
      saveScenarioCards(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when we have plan + lifeEvents
  }, []);

  function upsertLifeEvent(evt: LifeEvent) {
    setLifeEvents((prev) =>
      prev.some((e) => e.id === evt.id) ? prev.map((e) => (e.id === evt.id ? evt : e)) : [evt, ...prev],
    );
    const opts = plan ? { minAge: plan.startAge, maxAge: plan.endAge } : undefined;
    const overrides = buildOverridesFromLifeEvent(evt, opts);
    setCards((prev) => {
      const id = lifeCardId(evt.id);
      const existing = prev.find((c) => c.id === id);
      const nextCard: ScenarioCard = existing
        ? {
            ...existing,
            title: evt.title || "Life event",
            summary: evt.summary.join(" • "),
            enabled: evt.enabled,
            overrides,
          }
        : {
            id,
            createdAt: Date.now(),
            title: evt.title || "Life event",
            summary: evt.summary.join(" • "),
            enabled: evt.enabled,
            overrides,
          };
      const without = prev.filter((c) => c.id !== id);
      const next = [...without, nextCard].sort((a, b) => a.createdAt - b.createdAt);
      saveScenarioCards(next);
      return next;
    });
  }

  function deleteLifeEvent(id: string) {
    setLifeEvents((prev) => prev.filter((e) => e.id !== id));
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== lifeCardId(id));
      saveScenarioCards(next);
      return next;
    });
  }

  function toggleLifeEventEnabled(id: string, enabled: boolean) {
    setLifeEvents((prev) => prev.map((e) => (e.id === id ? { ...e, enabled } : e)));
    setCards((prev) => {
      const next = prev.map((c) => (c.id === lifeCardId(id) ? { ...c, enabled } : c));
      saveScenarioCards(next);
      return next;
    });
  }

  // Baseline: immutable; never mutated by scenario.
  const rows: YearRow[] = plan ? simulatePlan(plan) : [];
  // Scenario = baseline + enabled cards only (no draft). Used for planner API context so LLM never sees draft.
  const scenarioYearInputsForPlanner = useMemo(
    () => (plan ? getScenarioYearInputs(plan, cards, null) : []),
    [plan, cards],
  );
  const scenarioRowsForPlanner: YearRow[] =
    plan && scenarioYearInputsForPlanner.length > 0
      ? simulatePlan(plan, { yearInputs: scenarioYearInputsForPlanner })
      : rows;
  // Full scenario including draft for table/chart display.
  const scenarioYearInputs = useMemo(
    () => (plan ? getScenarioYearInputs(plan, cards, draftOverrides) : []),
    [plan, cards, draftOverrides],
  );
  const scenarioRows: YearRow[] =
    plan && scenarioYearInputs.length > 0
      ? simulatePlan(plan, { yearInputs: scenarioYearInputs })
      : rows;
  const currentRows = scenarioRows;
  const hasScenario = cards.some((c) => c.enabled) || (draftOverrides?.length ?? 0) > 0;

  const enabledOverrides = useMemo(() => {
    return cards
      .filter((c) => c.enabled)
      .sort((a, b) => a.createdAt - b.createdAt)
      .flatMap((c) => c.overrides);
  }, [cards]);

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

  const handleOpenHelper = useCallback(
    (helper: "income" | "home" | "expense" | "retirement" | "oneTimeEvent", prefill: Record<string, unknown>) => {
      if (helper === "income") {
        setIncomeModalPrefill(prefill);
        setEditingCardId(null);
        setIncomeModalOpen(true);
      }
    },
    [],
  );

  const handleIncomeSave = useCallback(
    (config: IncomeConfig) => {
      if (!plan) return;
      const overrides = buildOverridesFromCardConfig(plan, config);
      if (editingCardId) {
        const card = cards.find((c) => c.id === editingCardId);
        if (card) {
          // Edit: fully replace config and overrides. Invariant: card.overrides must be derivable from card.config alone.
          const summary =
            `Base $${(config.baseAnnual / 1000).toFixed(0)}k, bonus $${((config.bonusAnnual ?? 0) / 1000).toFixed(0)}k from age ${config.startAge}` +
            (config.observedBaseNetPayMonthly !== undefined && Number.isFinite(config.observedBaseNetPayMonthly)
              ? ". Using observed monthly take-home for cashflow; taxes still estimated from gross income. Observed take-home excludes bonuses/equity."
              : "");
          const updated: ScenarioCard = {
            ...card,
            config,
            overrides: [...overrides],
            title: "Income change",
            summary,
          };
          const next = cards.map((c) => (c.id === editingCardId ? updated : c));
          setCards(next);
          saveScenarioCards(next);
        }
      } else {
        const card = createScenarioCardFromConfig(config, overrides);
        setCards((prev) => {
          const next = [...prev, card];
          saveScenarioCards(next);
          return next;
        });
      }
      setEditingCardId(null);
      clearDraftRef.current?.();
      // Modal closes itself (possibly after brief confirmation when observed take-home is set)
    },
    [plan, editingCardId, cards],
  );

  const handleEditCard = useCallback((id: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card?.config || card.config.type !== "income") return;
    setEditingCardId(id);
    setIncomeModalPrefill({});
    setIncomeModalOpen(true);
  }, [cards]);

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
        <LifeEventsPanel
          events={lifeEvents}
          onUpsert={upsertLifeEvent}
          onDelete={deleteLifeEvent}
          onToggleEnabled={toggleLifeEventEnabled}
        />
        <Card>
          <CardHeader>
            <CardTitle>Scenario changes</CardTitle>
            <CardDescription>
              Toggle cards on/off. Scenario = baseline + enabled cards (later wins). Draft previews last.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl"
              onClick={() => {
                setIncomeModalPrefill({});
                setEditingCardId(null);
                setIncomeModalOpen(true);
              }}
            >
              Income editor
            </Button>
            <ScenarioCardsList
              cards={cards}
              onToggle={handleToggleCard}
              onDelete={handleDeleteCard}
              onEdit={handleEditCard}
            />
          </CardContent>
        </Card>

        <ChatPanel
          baselinePlan={plan}
          baselineRows={rows}
          scenarioRows={scenarioRowsForPlanner}
          enabledOverrides={enabledOverrides}
          cards={cards}
          draftOverrides={draftOverrides}
          onDraftChange={setDraftOverrides}
          onSaveDraft={handleSaveDraft}
          onOpenHelper={handleOpenHelper}
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
                Base and bonus, baseline vs scenario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-2 py-2 text-left font-medium">Age</th>
                      <th className="px-2 py-2 text-right font-medium">User base (BL)</th>
                      <th className="px-2 py-2 text-right font-medium">User base (SC)</th>
                      <th className="px-2 py-2 text-right font-medium">User bonus (BL)</th>
                      <th className="px-2 py-2 text-right font-medium">User bonus (SC)</th>
                      <th className="px-2 py-2 text-right font-medium">Partner base (BL)</th>
                      <th className="px-2 py-2 text-right font-medium">Partner base (SC)</th>
                      <th className="px-2 py-2 text-right font-medium">Partner bonus (BL)</th>
                      <th className="px-2 py-2 text-right font-medium">Partner bonus (SC)</th>
                      {hasScenario && (
                        <th className="px-2 py-2 text-right font-medium">Base cash (SC)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const scen = scenarioRows[i];
                      const ubBl = row.userBaseIncome ?? 0;
                      const ubSc = scen?.userBaseIncome ?? 0;
                      const uBoBl = row.userBonusIncome ?? 0;
                      const uBoSc = scen?.userBonusIncome ?? 0;
                      const pbBl = row.partnerBaseIncome ?? 0;
                      const pbSc = scen?.partnerBaseIncome ?? 0;
                      const pBoBl = row.partnerBonusIncome ?? 0;
                      const pBoSc = scen?.partnerBonusIncome ?? 0;
                      const hasPartner = plan.household.hasPartner;
                      return (
                        <tr key={row.yearIndex} className="border-b border-border/70 last:border-0">
                          <td className="px-2 py-1.5">{row.age}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(ubBl)}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${hasScenario && Math.abs(ubSc - ubBl) > 0.5 ? "font-medium" : ""}`}>
                            {formatCurrency(ubSc)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(uBoBl)}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${hasScenario && Math.abs(uBoSc - uBoBl) > 0.5 ? "font-medium" : ""}`}>
                            {formatCurrency(uBoSc)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{hasPartner ? formatCurrency(pbBl) : "—"}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${hasPartner && hasScenario && Math.abs(pbSc - pbBl) > 0.5 ? "font-medium" : ""}`}>
                            {hasPartner ? formatCurrency(pbSc) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{hasPartner ? formatCurrency(pBoBl) : "—"}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${hasPartner && hasScenario && Math.abs(pBoSc - pBoBl) > 0.5 ? "font-medium" : ""}`}>
                            {hasPartner ? formatCurrency(pBoSc) : "—"}
                          </td>
                          {hasScenario && (
                            <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                              {scenarioYearInputs[i]?.user?.observedBaseNetPayMonthly != null
                                ? `Observed ${formatCurrency(scenarioYearInputs[i]!.user!.observedBaseNetPayMonthly!)}/mo`
                                : "Modeled"}
                            </td>
                          )}
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
              <ProjectionBars
              rows={currentRows}
              yearInputs={hasScenario ? scenarioYearInputs : undefined}
            />
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

      {plan && (
        <IncomeHelperModal
          isOpen={incomeModalOpen}
          onClose={() => {
            setIncomeModalOpen(false);
            setEditingCardId(null);
          }}
          baselinePlan={plan}
          prefill={incomeModalPrefill}
          existingConfig={
            editingCardId
              ? (cards.find((c) => c.id === editingCardId)?.config as IncomeConfig | undefined)
              : undefined
          }
          onSave={handleIncomeSave}
        />
      )}
    </div>
  );
}


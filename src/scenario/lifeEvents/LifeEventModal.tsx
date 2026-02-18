"use client";

import { useEffect, useState } from "react";
import type {
  LifeEvent,
  LifeEventTemplateKey,
  Mutation,
} from "./types";
import type {
  IncomeSetRangeMutation,
  IncomeMilestoneMutation,
  OneTimeBonusMutation,
  IncomeCapMutation,
  IncomeGrowthStepMutation,
} from "./types";
import type { IncomeImpactKind } from "./impactOptions";
import { makeLifeEvent } from "./factory";
import { buildLifeEventSummary } from "./summary";
import { IncomeSetRangeRow } from "./IncomeSetRangeRow";
import { BreakIncomeImpactEditor } from "./BreakIncomeImpactEditor";
import { IncomeMilestonesEditor } from "./IncomeMilestonesEditor";
import { OneTimeBonusEditor } from "./OneTimeBonusEditor";
import { IncomeCapEditor } from "./IncomeCapEditor";
import { IncomeGrowthStepEditor } from "./IncomeGrowthStepEditor";
import { IncomeImpactPicker } from "./IncomeImpactPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const DEFAULT_START_AGE = 30;

function defaultIncomeSetRange(
  overrides?: Partial<IncomeSetRangeMutation>,
): IncomeSetRangeMutation {
  return {
    kind: "income_set_range",
    startAge: DEFAULT_START_AGE,
    endAge: null,
    baseAnnual: null,
    bonusAnnual: null,
    ...overrides,
  };
}

function isTemplateDuringSchoolMutation(
  m: IncomeSetRangeMutation,
): boolean {
  return (
    m.kind === "income_set_range" &&
    m.baseAnnual === 0 &&
    m.bonusAnnual === 0 &&
    m.endAge !== null
  );
}

function isTemplatePostGradMutation(
  m: IncomeSetRangeMutation,
  schoolEndAge: number | null,
): boolean {
  if (schoolEndAge === null) return false;
  return (
    m.kind === "income_set_range" &&
    m.endAge === null &&
    m.startAge === schoolEndAge + 1
  );
}

function getDuringSchoolMutation(
  mutations: Mutation[],
): IncomeSetRangeMutation | null {
  const found = mutations.find(
    (m): m is IncomeSetRangeMutation =>
      m.kind === "income_set_range" && isTemplateDuringSchoolMutation(m),
  );
  return found ?? null;
}

function getPostGradMutation(
  mutations: Mutation[],
  schoolEndAge: number | null,
): IncomeSetRangeMutation | null {
  if (schoolEndAge === null) return null;
  const found = mutations.find(
    (m): m is IncomeSetRangeMutation =>
      m.kind === "income_set_range" &&
      isTemplatePostGradMutation(m, schoolEndAge),
  );
  return found ?? null;
}

function isBreakOwnedMutation(m: Mutation): boolean {
  return (m as { mutationId?: string }).mutationId?.startsWith("break:") === true;
}

const BREAK_DURING_ID = "break:during";
const BREAK_AFTER_ID = "break:after";

function addBreakMutations(): Mutation[] {
  const during: IncomeSetRangeMutation = {
    mutationId: BREAK_DURING_ID,
    kind: "income_set_range",
    startAge: DEFAULT_START_AGE,
    endAge: DEFAULT_START_AGE + 2,
    baseAnnual: 0,
    bonusAnnual: 0,
  };
  const after: IncomeSetRangeMutation = {
    mutationId: BREAK_AFTER_ID,
    kind: "income_set_range",
    startAge: DEFAULT_START_AGE + 3,
    endAge: null,
    baseAnnual: null,
    bonusAnnual: null,
  };
  return [during, after];
}

function makeDefaultBreakMutations(): Mutation[] {
  return [
    {
      mutationId: BREAK_DURING_ID,
      kind: "income_set_range",
      appliesTo: "user",
      startAge: 30,
      endAge: 32,
      baseAnnual: 0,
      bonusAnnual: 0,
    },
    {
      mutationId: BREAK_AFTER_ID,
      kind: "income_set_range",
      appliesTo: "user",
      startAge: 33,
      endAge: null,
      baseAnnual: null,
      bonusAnnual: null,
    },
  ];
}

export type LifeEventModalProps = {
  open: boolean;
  event: LifeEvent | null;
  onClose: () => void;
  onSave: (evt: LifeEvent) => void;
  onDelete?: (id: string) => void;
};

type TabId = "income" | "expenses" | "debt";

const TABS: { id: TabId; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "expenses", label: "Expenses" },
  { id: "debt", label: "Debt" },
];

const TEMPLATE_OPTIONS: { value: LifeEventTemplateKey | ""; label: string }[] = [
  { value: "", label: "Custom" },
  { value: "grad_school", label: "Career break (i.e. grad school, sabbatical, etc.)" },
];

export type IncomeSectionKey =
  | "break"
  | "set_range"
  | "milestones"
  | "one_time_bonus"
  | "caps"
  | "growth_step";

function getPresentIncomeSections(mutations: Mutation[]): IncomeSectionKey[] {
  const hasBreak = mutations.some(isBreakOwnedMutation);
  const hasSetRange = mutations.some(
    (m) =>
      m.kind === "income_set_range" &&
      !isBreakOwnedMutation(m),
  );
  const hasMilestones = mutations.some((m) => m.kind === "income_milestone");
  const hasOneTimeBonus = mutations.some((m) => m.kind === "income_one_time_bonus");
  const hasCaps = mutations.some((m) => m.kind === "income_cap_range");
  const hasGrowthSteps = mutations.some((m) => m.kind === "income_growth_step");
  const order: IncomeSectionKey[] = [];
  if (hasBreak) order.push("break");
  if (hasSetRange) order.push("set_range");
  if (hasMilestones) order.push("milestones");
  if (hasOneTimeBonus) order.push("one_time_bonus");
  if (hasCaps) order.push("caps");
  if (hasGrowthSteps) order.push("growth_step");
  return order;
}

export function LifeEventModal({
  open,
  event,
  onClose,
  onSave,
  onDelete,
}: LifeEventModalProps) {
  const [title, setTitle] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("income");
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [createTemplateKey, setCreateTemplateKey] = useState<
    LifeEventTemplateKey | ""
  >("");
  const [incomeSectionOrder, setIncomeSectionOrder] = useState<
    IncomeSectionKey[]
  >([]);

  const isCreate = event === null;
  const effectiveTemplateKey: LifeEventTemplateKey | undefined =
    isCreate ? (createTemplateKey || undefined) : event?.templateKey;
  const isGradSchool = effectiveTemplateKey === "grad_school";

  useEffect(() => {
    if (!open) return;
    if (event !== null) {
      setTitle(event.title);
      setEnabled(event.enabled);
      const muts = event.mutations ?? [];
      const hasBreak = muts.some(isBreakOwnedMutation);
      const nextMuts =
        event.templateKey === "grad_school" && !hasBreak
          ? makeDefaultBreakMutations()
          : muts;
      setMutations(nextMuts);
      setIncomeSectionOrder(getPresentIncomeSections(nextMuts));
    } else {
      setTitle("");
      setEnabled(true);
      setMutations([]);
      setCreateTemplateKey("");
      setIncomeSectionOrder([]);
    }
    setActiveTab("income");
  }, [open, event?.id]);

  const duringSchool = getDuringSchoolMutation(mutations);
  const schoolEndAge = duringSchool?.endAge ?? null;
  const postGrad = getPostGradMutation(mutations, schoolEndAge);

  const incomeMutations = mutations.filter(
    (m): m is IncomeSetRangeMutation => m.kind === "income_set_range",
  );
  const hasBreakMutations = mutations.some(isBreakOwnedMutation);
  const otherIncomeMutations = incomeMutations.filter(
    (m) =>
      !isBreakOwnedMutation(m) &&
      !isTemplateDuringSchoolMutation(m) &&
      !isTemplatePostGradMutation(m, schoolEndAge),
  );
  const otherIncomeIndices = mutations
    .map((m, i) =>
      m.kind === "income_set_range" &&
      !isBreakOwnedMutation(m) &&
      !isTemplateDuringSchoolMutation(m) &&
      !isTemplatePostGradMutation(m, schoolEndAge)
        ? i
        : -1,
    )
    .filter((i) => i >= 0);

  const addIncomeImpact = () => {
    setMutations((prev) => [...prev, defaultIncomeSetRange()]);
  };

  const addBreakIncomeImpact = () => {
    setMutations((prev) => {
      const hasBreak = prev.some((m) => (m as { mutationId?: string }).mutationId === BREAK_DURING_ID);
      if (hasBreak) return prev;
      return [...prev, ...addBreakMutations()];
    });
  };

  const addMilestone = () => {
    const m: IncomeMilestoneMutation = {
      kind: "income_milestone",
      appliesTo: "user",
      age: DEFAULT_START_AGE,
      baseAnnual: null,
      bonusAnnual: null,
      growthPct: null,
    };
    setMutations((prev) => [...prev, m]);
  };

  const addOneTimeBonus = () => {
    const m: OneTimeBonusMutation = {
      kind: "income_one_time_bonus",
      appliesTo: "user",
      age: DEFAULT_START_AGE,
      amount: 0,
    };
    setMutations((prev) => [...prev, m]);
  };

  const addCap = () => {
    const m: IncomeCapMutation = {
      kind: "income_cap_range",
      appliesTo: "user",
      startAge: DEFAULT_START_AGE,
      endAge: null,
      baseCapAnnual: null,
      bonusCapAnnual: null,
    };
    setMutations((prev) => [...prev, m]);
  };

  const addGrowthStep = () => {
    const m: IncomeGrowthStepMutation = {
      kind: "income_growth_step",
      appliesTo: "user",
      age: DEFAULT_START_AGE,
      growthPct: 0,
    };
    setMutations((prev) => [...prev, m]);
  };

  const removeBreakImpact = () => {
    setMutations((prev) =>
      prev.filter((m) => !(m as { mutationId?: string }).mutationId?.startsWith("break:")),
    );
  };

  const updateMutationAt = (index: number, next: IncomeSetRangeMutation) => {
    setMutations((prev) => {
      const nextArr = [...prev];
      nextArr[index] = next;
      return nextArr;
    });
  };

  const updateIncomeMutation = (index: number, next: IncomeSetRangeMutation) => {
    const globalIdx = otherIncomeIndices[index];
    if (globalIdx !== undefined) updateMutationAt(globalIdx, next);
  };

  const deleteIncomeMutation = (index: number) => {
    const globalIdx = otherIncomeIndices[index];
    if (globalIdx === undefined) return;
    setMutations((prev) => prev.filter((_, i) => i !== globalIdx));
  };

  const removeMutationAt = (index: number) => {
    setMutations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (isCreate) {
      const evt = makeLifeEvent({
        title: trimmed,
        templateKey: createTemplateKey || undefined,
      });
      const evtWithMut = { ...evt, enabled, mutations };
      const evtWithSummary = {
        ...evtWithMut,
        summary: buildLifeEventSummary(evtWithMut),
      };
      onSave(evtWithSummary);
    } else {
      const updated = {
        ...event,
        title: trimmed,
        enabled,
        mutations,
      };
      const updatedWithSummary = {
        ...updated,
        summary: buildLifeEventSummary(updated),
      };
      onSave(updatedWithSummary);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!event || !onDelete) return;
    if (confirm("Delete this life event?")) {
      onDelete(event.id);
      onClose();
    }
  };

  const handleCreateTemplateChange = (value: string) => {
    const next = (value === "grad_school" ? "grad_school" : "") as
      | LifeEventTemplateKey
      | "";
    setCreateTemplateKey(next);
    if (next === "grad_school") {
      if (!title.trim()) setTitle("Career Break");
      setMutations((prev) =>
        prev.some(isBreakOwnedMutation) ? prev : makeDefaultBreakMutations(),
      );
    }
  };

  if (!open) return null;

  function bumpSectionToBottom(key: IncomeSectionKey) {
    setIncomeSectionOrder((prev) => {
      const next = prev.filter((k) => k !== key);
      next.push(key);
      return next;
    });
  }

  const handlePickIncomeImpact = (kind: IncomeImpactKind) => {
    if (kind === "income_set_range") {
      addBreakIncomeImpact();
      bumpSectionToBottom("break");
    } else if (kind === "income_milestone") {
      addMilestone();
      bumpSectionToBottom("milestones");
    } else if (kind === "income_one_time_bonus") {
      addOneTimeBonus();
      bumpSectionToBottom("one_time_bonus");
    } else if (kind === "income_cap_range") {
      addCap();
      bumpSectionToBottom("caps");
    } else if (kind === "income_growth_step") {
      addGrowthStep();
      bumpSectionToBottom("growth_step");
    } else if (kind === "income_401k_change") {
      return;
    } else {
      addIncomeImpact();
      bumpSectionToBottom("set_range");
    }
  };

  const hasMilestones = mutations.some((m) => m.kind === "income_milestone");
  const hasOneTimeBonus = mutations.some((m) => m.kind === "income_one_time_bonus");
  const hasCaps = mutations.some((m) => m.kind === "income_cap_range");
  const hasGrowthSteps = mutations.some((m) => m.kind === "income_growth_step");

  const renderIncomeSection = (key: IncomeSectionKey) => {
    switch (key) {
      case "break":
        if (!hasBreakMutations) return null;
        return (
          <BreakIncomeImpactEditor
            key="break"
            mutations={mutations}
            onChange={setMutations}
            showRemove={!isGradSchool}
            onRemove={!isGradSchool ? removeBreakImpact : undefined}
          />
        );
      case "set_range":
        if (otherIncomeMutations.length === 0) return null;
        return (
          <ul key="set_range" className="space-y-2">
            {otherIncomeMutations.map((m, i) => (
              <li key={i}>
                <IncomeSetRangeRow
                  value={m}
                  onChange={(next) => updateIncomeMutation(i, next)}
                  onDelete={() => deleteIncomeMutation(i)}
                />
              </li>
            ))}
          </ul>
        );
      case "milestones":
        if (!hasMilestones) return null;
        return (
          <div key="milestones" className="mt-4">
            <IncomeMilestonesEditor mutations={mutations} onChange={setMutations} />
          </div>
        );
      case "one_time_bonus":
        if (!hasOneTimeBonus) return null;
        return (
          <div key="one_time_bonus" className="mt-4">
            <OneTimeBonusEditor mutations={mutations} onChange={setMutations} />
          </div>
        );
      case "caps":
        if (!hasCaps) return null;
        return (
          <div key="caps" className="mt-4">
            <IncomeCapEditor mutations={mutations} onChange={setMutations} />
          </div>
        );
      case "growth_step":
        if (!hasGrowthSteps) return null;
        return (
          <div key="growth_step" className="mt-4">
            <IncomeGrowthStepEditor mutations={mutations} onChange={setMutations} />
          </div>
        );
      default:
        return null;
    }
  };

  const renderIncomeContent = () => (
    <>
      {mutations.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No income impacts yet. Add an income impact below.
        </p>
      )}
      {incomeSectionOrder.map((key) => renderIncomeSection(key))}
      <div className="mt-2">
        <IncomeImpactPicker
          onPick={handlePickIncomeImpact}
          buttonLabel={
            isGradSchool ? "Add another income impact" : "Add income impact"
          }
        />
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        aria-hidden
      />
      <Card className="relative z-10 w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">
            {isCreate ? "Create life event" : "Edit life event"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto">
          {isCreate && (
            <div className="space-y-1.5">
              <Label htmlFor="life-event-template">Template</Label>
              <select
                id="life-event-template"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={createTemplateKey}
                onChange={(e) => handleCreateTemplateChange(e.target.value)}
              >
                {TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.value || "custom"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="life-event-title">Event name</Label>
            <Input
              id="life-event-title"
              placeholder="e.g. Grad School"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="life-event-enabled">Enabled</Label>
            <Switch
              id="life-event-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {isCreate ? (
            <div className="space-y-2">
              <div className="flex gap-1 border-b border-border">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      "px-3 py-2 text-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="min-h-[80px] rounded-lg border border-border bg-muted/20 p-3">
                {activeTab === "income" ? renderIncomeContent() : (
                  <p className="text-sm text-muted-foreground">
                    No impacts yet. You will be able to add impacts here.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Impacts
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Income
                  </div>
                  {mutations.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">
                      No income impacts yet
                    </p>
                  )}
                  {incomeSectionOrder.map((key) => renderIncomeSection(key))}
                  <div className="mt-2">
                    <IncomeImpactPicker
                      onPick={handlePickIncomeImpact}
                      buttonLabel="Add another income impact"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Expenses
                  </div>
                  <p className="text-sm text-muted-foreground py-2">
                    No expense impacts yet
                  </p>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Debt
                  </div>
                  <p className="text-sm text-muted-foreground py-2">
                    No debt impacts yet
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={!title.trim()}>
              Save
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {!isCreate && onDelete ? (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

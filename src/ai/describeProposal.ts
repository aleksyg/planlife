import type { PlanState } from "@/engine";
import type { YearRow } from "@/engine";
import type { AiScenarioPatch } from "./types";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(pct: number): string {
  return `${pct.toFixed(0)}%`;
}

function formatRate(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

function describePatch(patch: AiScenarioPatch, baseline: PlanState): string {
  const endYearIndexInclusive =
    patch.type === "AddOneTimeEvent"
      ? patch.yearIndex
      : patch.endYearIndexInclusive ?? baseline.endAge - baseline.startAge;
  switch (patch.type) {
    case "SetIncomeRange": {
      const from =
        patch.who === "user"
          ? baseline.household.user.income.baseAnnual
          : baseline.household.partner?.income.baseAnnual ?? 0;
      const a0 = baseline.startAge + patch.startYearIndex;
      const a1 = baseline.startAge + endYearIndexInclusive;
      return `Set ${patch.who === "partner" ? "partner" : "your"} base salary to ${formatCurrency(
        patch.baseAnnual,
      )}/yr for Years ${patch.startYearIndex}–${endYearIndexInclusive} (ages ${a0}–${a1}). Baseline is ${formatCurrency(from)}/yr.`;
    }
    case "SetExpenseRange": {
      const label =
        patch.kind === "lifestyle"
          ? "lifestyle spending"
          : patch.kind === "housingRent"
            ? "housing (rent)"
            : "housing (PITI)";
      const a0 = baseline.startAge + patch.startYearIndex;
      const a1 = baseline.startAge + endYearIndexInclusive;
      return `Set ${label} to ${formatCurrency(patch.monthly)}/mo for Years ${patch.startYearIndex}–${endYearIndexInclusive} (ages ${a0}–${a1}).`;
    }
    case "SetContribRange": {
      const parts: string[] = [];
      if (patch.employeePreTaxPct != null) parts.push(`${formatPct(patch.employeePreTaxPct)} pre-tax`);
      if (patch.employeeRothPct != null) parts.push(`${formatPct(patch.employeeRothPct)} Roth`);
      if (patch.preTaxDeductionsMonthly != null)
        parts.push(`${formatCurrency(patch.preTaxDeductionsMonthly)}/mo deductions`);
      const a0 = baseline.startAge + patch.startYearIndex;
      const a1 = baseline.startAge + endYearIndexInclusive;
      return `Set ${patch.who === "partner" ? "partner" : "your"} contribution inputs (${parts.join(", ") || "no changes"}) for Years ${patch.startYearIndex}–${endYearIndexInclusive} (ages ${a0}–${a1}).`;
    }
    case "SetRatesRange": {
      const parts: string[] = [];
      if (patch.returnRate != null) parts.push(`returnRate ${formatRate(patch.returnRate)}`);
      if (patch.cashRate != null) parts.push(`cashRate ${formatRate(patch.cashRate)}`);
      if (patch.inflationRate != null) parts.push(`inflationRate ${formatRate(patch.inflationRate)}`);
      if (patch.stateTaxRate != null) parts.push(`stateTaxRate ${formatRate(patch.stateTaxRate)}`);
      const a0 = baseline.startAge + patch.startYearIndex;
      const a1 = baseline.startAge + endYearIndexInclusive;
      return `Set assumptions (${parts.join(", ") || "no changes"}) for Years ${patch.startYearIndex}–${endYearIndexInclusive} (ages ${a0}–${a1}).`;
    }
    case "AddOneTimeEvent": {
      const age = baseline.startAge + patch.yearIndex;
      const verb = patch.amount < 0 ? "Spend" : "Add";
      return `${verb} ${formatCurrency(Math.abs(patch.amount))} as a one-time event in Year ${patch.yearIndex} (age ${age}) — ${patch.label}.`;
    }
    default: {
      const _exhaustive: never = patch;
      return _exhaustive;
    }
  }
}

export type AiProposalExplanation = {
  changes: string[];
  implications: string[];
};

export function explainAiProposal(args: {
  baselinePlan: PlanState;
  baselineRows: readonly YearRow[];
  scenarioRows: readonly YearRow[];
  patches: AiScenarioPatch[];
}): AiProposalExplanation {
  const { baselinePlan, baselineRows, scenarioRows, patches } = args;

  const changes = patches.map((p) => describePatch(p, baselinePlan));

  const lastBase = baselineRows[baselineRows.length - 1];
  const lastScen = scenarioRows[scenarioRows.length - 1];

  const focusYearIndex =
    patches.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            ...patches.map((p) => (p.type === "AddOneTimeEvent" ? p.yearIndex : p.startYearIndex)),
            baselineRows.length - 1,
          ),
        );
  const focusBase = baselineRows[focusYearIndex];
  const focusScen = scenarioRows[focusYearIndex];

  const implications: string[] = [];

  if (focusBase && focusScen) {
    implications.push(
      `Year ${focusYearIndex} (age ${focusBase.age}) household gross income changes from ${formatCurrency(
        focusBase.grossIncome,
      )} to ${formatCurrency(focusScen.grossIncome)} (${formatCurrency(focusScen.grossIncome - focusBase.grossIncome)}).`,
    );
  }

  const y0b = baselineRows[0];
  const y0s = scenarioRows[0];
  if (y0b && y0s) {
    implications.push(
      `Year 0 taxes change from ${formatCurrency(y0b.taxesPaid)} to ${formatCurrency(y0s.taxesPaid)} (${formatCurrency(
        y0s.taxesPaid - y0b.taxesPaid,
      )}).`,
    );
  }

  if (lastBase && lastScen) {
    implications.push(
      `By age ${lastBase.age}, net worth changes by ${formatCurrency(lastScen.endNetWorth - lastBase.endNetWorth)} (from ${formatCurrency(
        lastBase.endNetWorth,
      )} to ${formatCurrency(lastScen.endNetWorth)}).`,
    );
  }

  return { changes, implications };
}


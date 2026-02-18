import type {
  LifeEvent,
  IncomeSetRangeMutation,
  IncomeGrowthRangeMutation,
  IncomeMilestoneMutation,
  OneTimeBonusMutation,
  IncomeCapMutation,
  IncomeGrowthStepMutation,
  IncomeAppliesTo,
} from "./types";

export function formatAgeRange(
  startAge: number,
  endAge: number | null,
): string {
  if (endAge === null) {
    return `from ${startAge} through retirement`;
  }
  if (endAge === startAge) {
    return `at age ${startAge}`;
  }
  return `from ${startAge}–${endAge}`;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatAppliesTo(appliesTo?: IncomeAppliesTo): string {
  if (appliesTo === "partner") return "Partner";
  if (appliesTo === "both") return "Household";
  return "Me";
}

function whoPrefix(appliesTo?: IncomeAppliesTo): string {
  return formatAppliesTo(appliesTo) + ": ";
}

function isBreakOwned(m: { mutationId?: string }): boolean {
  return m.mutationId?.startsWith("break:") === true;
}

function formatIncomeSetRange(m: IncomeSetRangeMutation): string {
  const range = formatAgeRange(m.startAge, m.endAge);
  const parts: string[] = [];
  if (m.baseAnnual !== null) {
    parts.push(`base ${formatMoney(m.baseAnnual)}`);
  }
  if (m.bonusAnnual !== null) {
    parts.push(`bonus ${formatMoney(m.bonusAnnual)}`);
  }
  const clause = parts.length > 0 ? parts.join(", ") : "unchanged";
  return `Income set ${range}: ${clause}`;
}

function formatIncomeGrowthRange(m: IncomeGrowthRangeMutation): string {
  const range = formatAgeRange(m.startAge, m.endAge);
  const parts: string[] = [];
  if (m.baseGrowthPct !== null) {
    parts.push(`base ${m.baseGrowthPct}%`);
  }
  if (m.bonusGrowthPct !== null) {
    parts.push(`bonus ${m.bonusGrowthPct}%`);
  }
  const clause = parts.length > 0 ? parts.join(", ") : "unchanged";
  return `Income growth ${range}: ${clause}`;
}

const BREAK_DURING_ID = "break:during";
const BREAK_AFTER_ID = "break:after";
const BREAK_AFTER_GROWTH_ID = "break:afterGrowth";

export function buildLifeEventSummary(
  event: Omit<LifeEvent, "summary"> & { summary?: string[] },
): string[] {
  const mutations = event.mutations ?? [];
  if (mutations.length === 0) {
    return ["No impacts defined yet"];
  }

  const breakDuring = mutations.find(
    (m): m is IncomeSetRangeMutation =>
      m.kind === "income_set_range" &&
      (m as { mutationId?: string }).mutationId === BREAK_DURING_ID,
  );
  const breakAfter = mutations.find(
    (m): m is IncomeSetRangeMutation =>
      m.kind === "income_set_range" &&
      (m as { mutationId?: string }).mutationId === BREAK_AFTER_ID,
  );
  const breakGrowth = mutations.find(
    (m): m is IncomeGrowthRangeMutation =>
      m.kind === "income_growth_range" &&
      (m as { mutationId?: string }).mutationId === BREAK_AFTER_GROWTH_ID,
  );

  const lines: string[] = [];

  if (breakDuring ?? breakAfter ?? breakGrowth) {
    if (breakDuring) {
      const who = whoPrefix(breakDuring.appliesTo);
      const range = formatAgeRange(breakDuring.startAge, breakDuring.endAge);
      const parts: string[] = [];
      if (breakDuring.baseAnnual !== null) {
        parts.push(`base ${formatMoney(breakDuring.baseAnnual)}`);
      }
      if (breakDuring.bonusAnnual !== null) {
        parts.push(`bonus ${formatMoney(breakDuring.bonusAnnual)}`);
      }
      const clause = parts.length > 0 ? parts.join(", ") : "unchanged";
      lines.push(`${who}Break income ${range}: ${clause}`);
    }
    if (breakAfter ?? breakGrowth) {
      const who = whoPrefix(
        (breakAfter ?? breakGrowth)?.appliesTo,
      );
      const anchorAge = breakAfter
        ? breakAfter.startAge
        : breakGrowth!.startAge;
      const afterParts: string[] = [];
      if (breakAfter) {
        const baseBonus: string[] = [];
        if (breakAfter.baseAnnual !== null) {
          baseBonus.push(`base ${formatMoney(breakAfter.baseAnnual)}`);
        }
        if (breakAfter.bonusAnnual !== null) {
          baseBonus.push(`bonus ${formatMoney(breakAfter.bonusAnnual)}`);
        }
        if (baseBonus.length > 0) {
          afterParts.push(`${baseBonus.join(", ")}`);
        }
      }
      let afterLine = `${who}After break at age ${anchorAge}`;
      if (afterParts.length > 0) {
        afterLine += `: ${afterParts.join(", ")}`;
      }
      if (breakGrowth) {
        const basePct = breakGrowth.baseGrowthPct;
        const bonusPct = breakGrowth.bonusGrowthPct;
        const hasBase = basePct !== null && Number.isFinite(basePct);
        const hasBonus = bonusPct !== null && Number.isFinite(bonusPct);
        if (hasBase && hasBonus && basePct === bonusPct) {
          afterLine += `; grows ${basePct}%/yr`;
        } else if (hasBase || hasBonus) {
          const growthParts: string[] = [];
          if (hasBase) growthParts.push(`base ${basePct}%/yr`);
          if (hasBonus) growthParts.push(`bonus ${bonusPct}%/yr`);
          afterLine += `; grows ${growthParts.join(", ")}`;
        }
      }
      lines.push(afterLine);
    }
  }

  for (const m of mutations) {
    if (isBreakOwned(m as { mutationId?: string })) continue;
    if (m.kind === "income_set_range") {
      lines.push(whoPrefix(m.appliesTo) + formatIncomeSetRange(m));
    } else if (m.kind === "income_growth_range") {
      lines.push(whoPrefix(m.appliesTo) + formatIncomeGrowthRange(m));
    } else if (m.kind === "income_milestone") {
      const mil = m as IncomeMilestoneMutation;
      const who = whoPrefix(mil.appliesTo);
      const parts: string[] = [];
      if (mil.baseAnnual !== null) parts.push(`base ${formatMoney(mil.baseAnnual)}`);
      if (mil.bonusAnnual !== null) parts.push(`bonus ${formatMoney(mil.bonusAnnual)}`);
      const clause = parts.length > 0 ? parts.join(", ") : "set";
      lines.push(`${who}Income milestone at age ${mil.age}: ${clause}`);
      if (mil.growthPct != null && Number.isFinite(mil.growthPct)) {
        lines.push(`${who}Income growth from age ${mil.age}: ${mil.growthPct}%`);
      }
    } else if (m.kind === "income_one_time_bonus") {
      const bon = m as OneTimeBonusMutation;
      lines.push(`${whoPrefix(bon.appliesTo)}One-time bonus at age ${bon.age}: ${formatMoney(bon.amount)}`);
    } else if (m.kind === "income_cap_range") {
      const cap = m as IncomeCapMutation;
      const who = whoPrefix(cap.appliesTo);
      const range =
        cap.endAge === null
          ? `from ${cap.startAge} through retirement`
          : `from ${cap.startAge}–${cap.endAge}`;
      const parts: string[] = [];
      if (cap.baseCapAnnual !== null) parts.push(`base ≤ ${formatMoney(cap.baseCapAnnual)}`);
      if (cap.bonusCapAnnual !== null) parts.push(`bonus ≤ ${formatMoney(cap.bonusCapAnnual)}`);
      const clause = parts.length > 0 ? parts.join(", ") : "cap";
      lines.push(`${who}Income cap ${range}: ${clause}`);
    } else if (m.kind === "income_growth_step") {
      const step = m as IncomeGrowthStepMutation;
      lines.push(`${whoPrefix(step.appliesTo)}Income growth from age ${step.age}: ${step.growthPct}%`);
    }
  }

  return lines.length > 0 ? lines : ["No impacts defined yet"];
}

export function withRebuiltSummary(evt: LifeEvent): LifeEvent {
  const { summary: _s, ...rest } = evt;
  return {
    ...evt,
    summary: buildLifeEventSummary(rest),
  };
}

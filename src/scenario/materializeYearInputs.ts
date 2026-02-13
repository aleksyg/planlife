import type { PlanState, YearInputs } from "@/engine";
import type {
  ContributionSegmentOverride,
  ExpenseSegmentOverride,
  IncomeSegmentOverride,
  OneTimeEventOverride,
  RatesSegmentOverride,
  ScenarioOverrides,
  ScenarioWho,
} from "@/scenario/types";

function yearsCount(plan: PlanState): number {
  return Math.max(1, plan.endAge - plan.startAge + 1);
}

function rangeEnd(endYearIndexInclusive: number | undefined, maxYearIndex: number): number {
  return endYearIndexInclusive == null ? maxYearIndex : endYearIndexInclusive;
}

function isActiveRange(
  yearIndex: number,
  startYearIndex: number,
  endYearIndexInclusive: number | undefined,
  maxYearIndex: number,
): boolean {
  return yearIndex >= startYearIndex && yearIndex <= rangeEnd(endYearIndexInclusive, maxYearIndex);
}

function rangeSpan(
  startYearIndex: number,
  endYearIndexInclusive: number | undefined,
  maxYearIndex: number,
): number {
  return rangeEnd(endYearIndexInclusive, maxYearIndex) - startYearIndex;
}

function pickBest<T extends { startYearIndex: number; endYearIndexInclusive?: number }>(
  items: readonly T[] | undefined,
  yearIndex: number,
  maxYearIndex: number,
): T | null {
  if (!items || items.length === 0) return null;
  let best: { item: T; span: number; idx: number } | null = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (!isActiveRange(yearIndex, it.startYearIndex, it.endYearIndexInclusive, maxYearIndex)) continue;
    const span = rangeSpan(it.startYearIndex, it.endYearIndexInclusive, maxYearIndex);
    if (!best) best = { item: it, span, idx: i };
    else if (span < best.span) best = { item: it, span, idx: i };
    else if (span === best.span && i > best.idx) best = { item: it, span, idx: i };
  }
  return best?.item ?? null;
}

function pickBestWhere<T extends { startYearIndex: number; endYearIndexInclusive?: number }>(
  items: readonly T[] | undefined,
  yearIndex: number,
  maxYearIndex: number,
  predicate: (t: T) => boolean,
): T | null {
  if (!items) return null;
  return pickBest(items.filter(predicate), yearIndex, maxYearIndex);
}

function baselineIncomeBaseAnnual(plan: PlanState, who: ScenarioWho, yearIndex: number): number {
  const person =
    who === "user" ? plan.household.user : plan.household.hasPartner && plan.household.partner ? plan.household.partner : null;
  if (!person) return 0;
  const growth = Math.pow(1 + person.income.incomeGrowthRate, Math.max(0, yearIndex));
  return person.income.baseAnnual * growth;
}

function baselineLifestyleMonthly(plan: PlanState): number {
  return plan.expenses.mode === "total"
    ? plan.expenses.lifestyleMonthly
    : plan.expenses.items.reduce((s, x) => s + x.monthlyAmount, 0);
}

function baselineHousingMonthly(plan: PlanState): number {
  return plan.household.housing.status === "rent"
    ? plan.household.housing.monthlyRent
    : plan.household.housing.monthlyPaymentPITI;
}

function applyIncomeOverride(yi: YearInputs, who: ScenarioWho, baseAnnual: number) {
  if (who === "user") yi.user = { ...(yi.user ?? {}), baseAnnual };
  else yi.partner = { ...(yi.partner ?? {}), baseAnnual };
}

function applyContributionOverride(yi: YearInputs, seg: ContributionSegmentOverride) {
  const target = seg.who === "user" ? (yi.user ?? {}) : (yi.partner ?? {});
  const retirement = { ...(target.retirement ?? {}) };

  if (seg.employeePreTaxPct != null) retirement.employeePreTaxContributionPct = seg.employeePreTaxPct;
  if (seg.employeeRothPct != null) retirement.employeeRothContributionPct = seg.employeeRothPct;
  if (Object.keys(retirement).length > 0) target.retirement = retirement;
  if (seg.preTaxDeductionsMonthly != null) target.preTaxDeductionsMonthly = seg.preTaxDeductionsMonthly;

  if (seg.who === "user") yi.user = target;
  else yi.partner = target;
}

function applyExpenseOverride(yi: YearInputs, seg: ExpenseSegmentOverride) {
  if (seg.kind === "lifestyle") yi.lifestyleMonthly = seg.monthly;
  else yi.housingMonthly = seg.monthly;
}

function applyRatesOverride(yi: YearInputs, seg: RatesSegmentOverride) {
  const rates = { ...(yi.rates ?? {}) };
  if (seg.returnRate != null) rates.returnRate = seg.returnRate;
  if (seg.inflationRate != null) rates.inflationRate = seg.inflationRate;
  if (seg.cashRate != null) rates.cashRate = seg.cashRate;
  if (seg.stateTaxRate != null) rates.stateTaxRate = seg.stateTaxRate;
  yi.rates = rates;
}

function applyOneTimeEvents(yi: YearInputs, events: readonly OneTimeEventOverride[]) {
  if (!events.length) return;
  yi.oneTimeEvents = [
    ...(yi.oneTimeEvents ?? []),
    ...events.map((e) => ({ amount: e.amount, label: e.label, fromBucket: e.fromBucket })),
  ];
}

/**
 * Materialize explicit per-year inputs. Baseline values are expanded to a full `YearInputs[]`,
 * then sparse overrides are applied deterministically:
 * - most-specific range wins (smallest span)\n+ * - later-added override wins on ties\n+ */
export function materializeYearInputs(plan: PlanState, overrides: ScenarioOverrides): YearInputs[] {
  const n = yearsCount(plan);
  const maxYearIndex = n - 1;

  // Start with baseline explicit per-year inputs.
  const out: YearInputs[] = Array.from({ length: n }, (_, yearIndex) => {
    const yi: YearInputs = {
      yearIndex,
      user: {
        baseAnnual: baselineIncomeBaseAnnual(plan, "user", yearIndex),
        preTaxDeductionsMonthly: plan.household.user.income.preTaxDeductionsMonthly ?? 0,
        retirement: {
          hasPlan: plan.household.user.income.retirement?.hasPlan ?? false,
          employeePreTaxContributionPct:
            plan.household.user.income.retirement?.employeePreTaxContributionPct ?? 0,
          employeeRothContributionPct:
            plan.household.user.income.retirement?.employeeRothContributionPct ?? 0,
          hasEmployerMatch: plan.household.user.income.retirement?.hasEmployerMatch ?? false,
          employerMatchPct: plan.household.user.income.retirement?.employerMatchPct ?? 0,
          employerMatchUpToPct: plan.household.user.income.retirement?.employerMatchUpToPct ?? 0,
        },
      },
      lifestyleMonthly: baselineLifestyleMonthly(plan),
      housingMonthly: baselineHousingMonthly(plan),
      rates: {
        returnRate: plan.assumptions.returnRate,
        inflationRate: plan.assumptions.inflationRate,
        cashRate: plan.assumptions.cashRate,
        stateTaxRate: plan.assumptions.stateTaxRate,
      },
    };

    if (plan.household.hasPartner && plan.household.partner) {
      yi.partner = {
        baseAnnual: baselineIncomeBaseAnnual(plan, "partner", yearIndex),
        preTaxDeductionsMonthly: plan.household.partner.income.preTaxDeductionsMonthly ?? 0,
        retirement: {
          hasPlan: plan.household.partner.income.retirement?.hasPlan ?? false,
          employeePreTaxContributionPct:
            plan.household.partner.income.retirement?.employeePreTaxContributionPct ?? 0,
          employeeRothContributionPct:
            plan.household.partner.income.retirement?.employeeRothContributionPct ?? 0,
          hasEmployerMatch: plan.household.partner.income.retirement?.hasEmployerMatch ?? false,
          employerMatchPct: plan.household.partner.income.retirement?.employerMatchPct ?? 0,
          employerMatchUpToPct: plan.household.partner.income.retirement?.employerMatchUpToPct ?? 0,
        },
      };
    }

    return yi;
  });

  // Apply best segment per yearIndex (by specificity/recency).
  for (let yearIndex = 0; yearIndex <= maxYearIndex; yearIndex++) {
    const incomeUser = pickBestWhere<IncomeSegmentOverride>(
      overrides.incomeSegments,
      yearIndex,
      maxYearIndex,
      (s) => s.who === "user",
    );
    if (incomeUser) applyIncomeOverride(out[yearIndex]!, "user", incomeUser.baseAnnual);

    const incomePartner = pickBestWhere<IncomeSegmentOverride>(
      overrides.incomeSegments,
      yearIndex,
      maxYearIndex,
      (s) => s.who === "partner",
    );
    if (incomePartner) applyIncomeOverride(out[yearIndex]!, "partner", incomePartner.baseAnnual);

    const lifestyleSeg = pickBestWhere<ExpenseSegmentOverride>(
      overrides.expenseSegments,
      yearIndex,
      maxYearIndex,
      (s) => s.kind === "lifestyle",
    );
    if (lifestyleSeg) applyExpenseOverride(out[yearIndex]!, lifestyleSeg);

    const housingSeg = pickBestWhere<ExpenseSegmentOverride>(
      overrides.expenseSegments,
      yearIndex,
      maxYearIndex,
      (s) => s.kind !== "lifestyle",
    );
    if (housingSeg) applyExpenseOverride(out[yearIndex]!, housingSeg);

    const contribUser = pickBestWhere<ContributionSegmentOverride>(
      overrides.contributionSegments,
      yearIndex,
      maxYearIndex,
      (s) => s.who === "user",
    );
    if (contribUser) applyContributionOverride(out[yearIndex]!, contribUser);

    const contribPartner = pickBestWhere<ContributionSegmentOverride>(
      overrides.contributionSegments,
      yearIndex,
      maxYearIndex,
      (s) => s.who === "partner",
    );
    if (contribPartner) applyContributionOverride(out[yearIndex]!, contribPartner);

    const ratesSeg = pickBest<RatesSegmentOverride>(overrides.ratesSegments, yearIndex, maxYearIndex);
    if (ratesSeg) applyRatesOverride(out[yearIndex]!, ratesSeg);
  }

  // Apply events (can be many per yearIndex).
  if (overrides.oneTimeEvents && overrides.oneTimeEvents.length) {
    const byYear = new Map<number, OneTimeEventOverride[]>();
    for (const e of overrides.oneTimeEvents) {
      const arr = byYear.get(e.yearIndex) ?? [];
      arr.push(e);
      byYear.set(e.yearIndex, arr);
    }
    for (const [yearIndex, events] of byYear.entries()) {
      if (yearIndex < 0 || yearIndex > maxYearIndex) continue;
      applyOneTimeEvents(out[yearIndex]!, events);
    }
  }

  return out;
}


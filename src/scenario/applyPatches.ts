import type { ScenarioOverrides, ScenarioPatch } from "@/scenario/types";

export function applyScenarioPatches(
  base: ScenarioOverrides,
  patches: readonly ScenarioPatch[],
): ScenarioOverrides {
  let next: ScenarioOverrides = { ...base };

  for (const p of patches) {
    switch (p.type) {
      case "SetIncomeRange": {
        next = {
          ...next,
          incomeSegments: [
            ...(next.incomeSegments ?? []),
            {
              who: p.who,
              startYearIndex: p.startYearIndex,
              endYearIndexInclusive: p.endYearIndexInclusive,
              baseAnnual: p.baseAnnual,
            },
          ],
        };
        break;
      }
      case "SetExpenseRange": {
        next = {
          ...next,
          expenseSegments: [
            ...(next.expenseSegments ?? []),
            {
              kind: p.kind,
              startYearIndex: p.startYearIndex,
              endYearIndexInclusive: p.endYearIndexInclusive,
              monthly: p.monthly,
            },
          ],
        };
        break;
      }
      case "SetContribRange": {
        next = {
          ...next,
          contributionSegments: [
            ...(next.contributionSegments ?? []),
            {
              who: p.who,
              startYearIndex: p.startYearIndex,
              endYearIndexInclusive: p.endYearIndexInclusive,
              employeePreTaxPct: p.employeePreTaxPct,
              employeeRothPct: p.employeeRothPct,
              preTaxDeductionsMonthly: p.preTaxDeductionsMonthly,
            },
          ],
        };
        break;
      }
      case "SetRatesRange": {
        next = {
          ...next,
          ratesSegments: [
            ...(next.ratesSegments ?? []),
            {
              startYearIndex: p.startYearIndex,
              endYearIndexInclusive: p.endYearIndexInclusive,
              returnRate: p.returnRate,
              inflationRate: p.inflationRate,
              cashRate: p.cashRate,
              stateTaxRate: p.stateTaxRate,
            },
          ],
        };
        break;
      }
      case "AddOneTimeEvent": {
        next = {
          ...next,
          oneTimeEvents: [
            ...(next.oneTimeEvents ?? []),
            {
              yearIndex: p.yearIndex,
              amount: p.amount,
              label: p.label,
              fromBucket: p.fromBucket,
            },
          ],
        };
        break;
      }
      default: {
        return next;
      }
    }
  }

  return next;
}


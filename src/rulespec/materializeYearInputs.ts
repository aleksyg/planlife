import type { PlanState, YearInputs } from "@/engine";
import { buildSeries } from "./buildSeries";
import type { Override, RuleSpecInputs } from "./types";

function assertLength(name: string, arr: readonly number[], n: number) {
  if (arr.length !== n) throw new Error(`${name} must have length ${n} (got ${arr.length}).`);
}

function getObservedNetAtYearIndex(overrides: Override[], yearIndex: number, startAge: number): number | undefined {
  const age = startAge + yearIndex;
  let value: number | undefined;
  for (const op of overrides) {
    if (op.fromAge > age) continue;
    const toAge = op.toAge;
    if (toAge != null && age > toAge) continue;
    value = op.value;
  }
  return value;
}

/**
 * Materialize a dense `YearInputs[]` from rule specs.
 *
 * Invariants:
 * - `out.length === timeline.length`
 * - `out[i].yearIndex === i` for all i
 */
export function materializeYearInputs(_plan: PlanState, specs: RuleSpecInputs): YearInputs[] {
  const n = specs.timeline.length;

  const userBase = buildSeries(specs.income.user.base, specs.timeline);
  const userBonus = buildSeries(specs.income.user.bonus, specs.timeline);
  const lifestyle = buildSeries(specs.spend.lifestyleMonthly, specs.timeline);
  const housing = buildSeries(specs.spend.housingMonthly, specs.timeline);

  assertLength("userBase", userBase, n);
  assertLength("userBonus", userBonus, n);
  assertLength("lifestyle", lifestyle, n);
  assertLength("housing", housing, n);

  const partnerBase = specs.partnerEnabled && specs.income.partner ? buildSeries(specs.income.partner.base, specs.timeline) : null;
  const partnerBonus = specs.partnerEnabled && specs.income.partner ? buildSeries(specs.income.partner.bonus, specs.timeline) : null;
  if (partnerBase) assertLength("partnerBase", partnerBase, n);
  if (partnerBonus) assertLength("partnerBonus", partnerBonus, n);

  const out: YearInputs[] = Array.from({ length: n }, (_, yearIndex) => {
    const yi: YearInputs = {
      yearIndex,
      user: {
        baseAnnual: userBase[yearIndex]!,
        bonusAnnual: userBonus[yearIndex]!,
      },
      lifestyleMonthly: lifestyle[yearIndex]!,
      housingMonthly: housing[yearIndex]!,
    };

    const observedUser = getObservedNetAtYearIndex(
      specs.income.user.observedBaseNetPayMonthlyOverrides,
      yearIndex,
      specs.timeline.startAge,
    );
    if (observedUser !== undefined) yi.user!.observedBaseNetPayMonthly = observedUser;

    if (partnerBase && partnerBonus && specs.income.partner) {
      yi.partner = {
        baseAnnual: partnerBase[yearIndex]!,
        bonusAnnual: partnerBonus[yearIndex]!,
      };
      const observedPartner = getObservedNetAtYearIndex(
        specs.income.partner.observedBaseNetPayMonthlyOverrides,
        yearIndex,
        specs.timeline.startAge,
      );
      if (observedPartner !== undefined) yi.partner!.observedBaseNetPayMonthly = observedPartner;
    }

    return yi;
  });

  return out;
}


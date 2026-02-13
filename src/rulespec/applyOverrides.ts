import type { Override, RuleSpecInputs, TargetKey, TargetedOverride } from "./types";

function assertNever(x: never): never {
  throw new Error(`Unexpected override: ${JSON.stringify(x)}`);
}

function isPartnerTarget(target: TargetKey): boolean {
  return target.startsWith("income.partner.");
}

function appendOverride(specs: RuleSpecInputs, target: TargetKey, op: Override): RuleSpecInputs {
  // Immutable structural updates; deterministic.
  switch (target) {
    case "income.user.base":
      return {
        ...specs,
        income: { ...specs.income, user: { ...specs.income.user, base: { ...specs.income.user.base, overrides: [...specs.income.user.base.overrides, op] } } },
      };
    case "income.user.bonus":
      return {
        ...specs,
        income: { ...specs.income, user: { ...specs.income.user, bonus: { ...specs.income.user.bonus, overrides: [...specs.income.user.bonus.overrides, op] } } },
      };
    case "income.partner.base": {
      if (!specs.partnerEnabled || !specs.income.partner) {
        throw new Error("Cannot apply partner override: partner is not enabled.");
      }
      return {
        ...specs,
        income: { ...specs.income, partner: { ...specs.income.partner, base: { ...specs.income.partner.base, overrides: [...specs.income.partner.base.overrides, op] } } },
      };
    }
    case "income.partner.bonus": {
      if (!specs.partnerEnabled || !specs.income.partner) {
        throw new Error("Cannot apply partner override: partner is not enabled.");
      }
      return {
        ...specs,
        income: { ...specs.income, partner: { ...specs.income.partner, bonus: { ...specs.income.partner.bonus, overrides: [...specs.income.partner.bonus.overrides, op] } } },
      };
    }
    case "spend.lifestyle":
      return { ...specs, spend: { ...specs.spend, lifestyleMonthly: { ...specs.spend.lifestyleMonthly, overrides: [...specs.spend.lifestyleMonthly.overrides, op] } } };
    case "spend.housing":
      return { ...specs, spend: { ...specs.spend, housingMonthly: { ...specs.spend.housingMonthly, overrides: [...specs.spend.housingMonthly.overrides, op] } } };
    default:
      return assertNever(target);
  }
}

/**
 * Apply structured overrides to the rule-spec inputs.
 * This function is text-agnostic and does not interpret user messages.
 */
export function applyOverridesToRuleSpecInputs(base: RuleSpecInputs, ops: readonly TargetedOverride[]): RuleSpecInputs {
  let next = base;
  for (const op of ops) {
    if (isPartnerTarget(op.target) && !next.partnerEnabled) {
      // Structural constraint: no partner edits unless partner is enabled.
      throw new Error("Cannot apply partner override: partner is not enabled.");
    }
    // Strip target and append the override payload to the component.
    const override: Override =
      op.kind === "set"
        ? { kind: "set", fromAge: op.fromAge, value: op.value }
        : op.kind === "add"
          ? { kind: "add", fromAge: op.fromAge, toAge: op.toAge, value: op.value }
          : { kind: "mult", fromAge: op.fromAge, toAge: op.toAge, value: op.value };
    next = appendOverride(next, op.target, override);
  }
  return next;
}


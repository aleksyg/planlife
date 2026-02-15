import type { AiScenarioPatch, TargetedOverride } from "@/ai/types";
import type { AiPromptPayload } from "@/ai/promptPayload";

const LARGE_ONE_TIME_SPEND = 50_000;

export function isPartnerPatch(patch: AiScenarioPatch): boolean {
  return (
    (patch.type === "SetIncomeRange" && patch.who === "partner") ||
    (patch.type === "SetContribRange" && patch.who === "partner")
  );
}

export function isPartnerOverrideTarget(override: TargetedOverride): boolean {
  return (
    override.target === "income.partner.base" ||
    override.target === "income.partner.bonus" ||
    override.target === "income.partner.base.growthPct" ||
    override.target === "income.partner.bonus.growthPct"
  );
}

export function computeConfirmationsRequired(
  patches: readonly AiScenarioPatch[],
  ctx: AiPromptPayload,
): string[] {
  const out: string[] = [];
  const maxYearIndex = ctx.allowedMutations.yearIndex.max;

  const hasPartnerMutation = patches.some(isPartnerPatch);
  if (hasPartnerMutation) out.push("Confirm: this proposal changes partner inputs.");

  const addOnce = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };

  for (const p of patches) {
    if (p.type === "SetIncomeRange" && p.baseAnnual === 0) {
      const end = p.endYearIndexInclusive ?? maxYearIndex;
      const years = end - p.startYearIndex + 1;
      if (years >= 1) {
        addOnce(
          `Confirm: set ${p.who === "partner" ? "partner" : "your"} income to $0 for ${years} year(s) (Years ${p.startYearIndex}–${end}).`,
        );
      }
    }
    if (p.type === "AddOneTimeEvent" && p.amount < 0 && Math.abs(p.amount) >= LARGE_ONE_TIME_SPEND) {
      addOnce(
        `Confirm: one-time spending of ${Math.abs(p.amount).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })} in Year ${p.yearIndex}.`,
      );
    }
  }

  return out;
}

export function computeConfirmationsRequiredFromOverrides(
  overrides: readonly TargetedOverride[],
  _ctx: AiPromptPayload,
): string[] {
  const out: string[] = [];
  const hasPartner = overrides.some(isPartnerOverrideTarget);
  if (hasPartner) out.push("Confirm: this proposal changes partner inputs.");
  for (const o of overrides) {
    if ((o.target === "income.user.base" || o.target === "income.partner.base") && o.kind === "set" && o.value === 0) {
      const label = o.target.startsWith("income.partner") ? "partner" : "your";
      if (!out.some((s) => s.includes(`${label} income to $0`))) {
        out.push(`Confirm: set ${label} base income to $0 starting at age ${o.fromAge}.`);
      }
    }
  }
  return out;
}


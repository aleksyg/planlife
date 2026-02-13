import type { AiScenarioPatch } from "@/ai/types";
import type { AiPromptPayload } from "@/ai/promptPayload";

const LARGE_ONE_TIME_SPEND = 50_000;

export function isPartnerPatch(patch: AiScenarioPatch): boolean {
  return (
    (patch.type === "SetIncomeRange" && patch.who === "partner") ||
    (patch.type === "SetContribRange" && patch.who === "partner")
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


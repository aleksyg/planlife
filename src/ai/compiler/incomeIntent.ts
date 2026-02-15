/**
 * Deterministic income-intent classification from the raw user message.
 * Used server-side to gate allowed actions (bonus-only vs total-comp vs base-only)
 * and prevent cross-solving (e.g. bonus-only must not change base or total comp).
 */

export type IncomeIntent =
  | "BONUS_ONLY"
  | "TOTAL_COMP_ONLY"
  | "BASE_ONLY"
  | "BONUS_AND_TOTAL_COMP"
  | "AMBIGUOUS_CONFLICT"
  | "NONE";

const EXPLICIT_TOTAL_COMP = [
  " total comp",
  " total compensation",
  " total comp.",
  " all-in",
  " all in",
  " tc ",
];
const BONUS_PHRASES = [" bonus", " bonuses"];
const BASE_PHRASES = [" base", " base salary", " salary", " base pay", " fixed salary"];
const AMBIGUOUS_PHRASES = [" cap", " cap comp", " never exceed", " max ", " at most", " maximum"];

function normalize(text: string): string {
  return ` ${text.toLowerCase().trim()} `;
}

/** True if message explicitly mentions total comp (phrases) or "make/to $X" without "bonus" or "base". */
function hasTotalCompIntent(msg: string, hasBonus: boolean, hasBase: boolean): boolean {
  const explicit = EXPLICIT_TOTAL_COMP.some((p) => msg.includes(p)) || /\b(total\s*comp|all[- ]?in)\b/.test(msg);
  if (explicit) return true;
  if (hasBonus) return false;
  if (hasBase) return false;
  return /(make|making|will make|will be)\s+\$?\d+/.test(msg) || /(to|at)\s+\$?\d+\s*(k|m|million|thousand)?\b/.test(msg);
}

/**
 * Classify income-related intent from the last user message.
 * Order matters: bonus-only must not be confused with total-comp when user says "500k bonus".
 */
export function deriveIncomeIntent(userMessage: string): IncomeIntent {
  const msg = normalize(userMessage);

  const hasBonus = BONUS_PHRASES.some((p) => msg.includes(p));
  const hasBase = BASE_PHRASES.some((p) => msg.includes(p));
  const hasTotalComp = hasTotalCompIntent(msg, hasBonus, hasBase);
  const hasAmbiguous = AMBIGUOUS_PHRASES.some((p) => msg.includes(p));

  if (hasAmbiguous && !hasBonus && !hasBase && !hasTotalComp) return "AMBIGUOUS_CONFLICT";
  if (hasAmbiguous && (hasTotalComp || hasBonus) && !hasBase) return "AMBIGUOUS_CONFLICT";

  if (hasBonus && hasTotalComp) return "BONUS_AND_TOTAL_COMP";
  if (hasBonus && !hasTotalComp) return "BONUS_ONLY";
  if (hasTotalComp && !hasBonus && !hasBase) return "TOTAL_COMP_ONLY";
  if (hasBase && !hasTotalComp && !hasBonus) return "BASE_ONLY";

  return "NONE";
}

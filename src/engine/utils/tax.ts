import type { TaxFilingStatus } from '../types/planState';

/**
 * Deterministic federal + payroll tax utilities.
 *
 * v1 notes:
 * - Uses a fixed policy table (no bracket inflation / year-to-year indexing yet).
 * - Values below are locked to the exact 2026 IRS/SSA numbers (Single + Married Filing Jointly).
 * - No credits, itemized deductions, state/local taxes, etc.
 */

export type TaxBracket = {
  /** Upper bound for this bracket; null means "no upper bound" (top bracket). */
  upTo: number | null;
  /** Marginal rate for income in this bracket (e.g. 0.22). */
  rate: number;
};

export type TaxPolicy = {
  standardDeduction: Record<TaxFilingStatus, number>;
  federalBrackets: Record<TaxFilingStatus, TaxBracket[]>;

  // Employee-side payroll taxes
  socialSecurityRate: number;
  socialSecurityWageBase: number;

  medicareRate: number;
  additionalMedicareRate: number;
  additionalMedicareThreshold: Record<TaxFilingStatus, number>;
};

/**
 * 2026 policy constants.
 *
 * Sources:
 * - IRS IR-2025-103 (tax year 2026 inflation adjustments): standard deduction + brackets
 * - SSA OASDI contribution and benefit base: 2026 wage base
 * - IRS Additional Medicare Tax thresholds (statutory)
 */
export const TAX_POLICY_2026: TaxPolicy = {
  standardDeduction: {
    single: 16_100,
    marriedJoint: 32_200,
  },
  federalBrackets: {
    single: [
      { upTo: 12_400, rate: 0.1 },
      { upTo: 50_400, rate: 0.12 },
      { upTo: 105_700, rate: 0.22 },
      { upTo: 201_775, rate: 0.24 },
      { upTo: 256_225, rate: 0.32 },
      { upTo: 640_600, rate: 0.35 },
      { upTo: null, rate: 0.37 },
    ],
    marriedJoint: [
      { upTo: 24_800, rate: 0.1 },
      { upTo: 100_800, rate: 0.12 },
      { upTo: 211_400, rate: 0.22 },
      { upTo: 403_550, rate: 0.24 },
      { upTo: 512_450, rate: 0.32 },
      { upTo: 768_700, rate: 0.35 },
      { upTo: null, rate: 0.37 },
    ],
  },

  socialSecurityRate: 0.062,
  socialSecurityWageBase: 184_500,

  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThreshold: {
    single: 200_000,
    marriedJoint: 250_000,
  },
};

// Back-compat name for default policy used by callers.
export const DEFAULT_TAX_POLICY: TaxPolicy = TAX_POLICY_2026;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function getStandardDeduction(
  filingStatus: TaxFilingStatus,
  policy: TaxPolicy = DEFAULT_TAX_POLICY,
): number {
  return policy.standardDeduction[filingStatus];
}

/**
 * Compute federal income tax on taxable income AFTER deductions (i.e. after standard deduction).
 * Assumes `taxableAfterDeductions` is already clamped to >= 0.
 */
export function computeFederalIncomeTax(
  taxableAfterDeductions: number,
  filingStatus: TaxFilingStatus,
  policy: TaxPolicy = DEFAULT_TAX_POLICY,
): number {
  const taxable = Math.max(0, taxableAfterDeductions);
  const brackets = policy.federalBrackets[filingStatus];

  let tax = 0;
  let prevCap = 0;

  for (const bracket of brackets) {
    const cap = bracket.upTo ?? Infinity;
    const amountInBracket = Math.max(0, Math.min(taxable, cap) - prevCap);
    if (amountInBracket <= 0) {
      prevCap = cap;
      continue;
    }
    tax += amountInBracket * bracket.rate;
    prevCap = cap;
    if (taxable <= cap) break;
  }

  return round2(tax);
}

export type PayrollTaxBreakdown = {
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  total: number;
};

/**
 * Compute employee-side payroll taxes (FICA) from per-person wages subject to FICA.
 *
 * Inputs should already reflect any reductions that DO affect FICA wages
 * (e.g. Section 125 pre-tax benefits). Do NOT subtract 401k pre-tax contributions here.
 */
export function computeEmployeePayrollTaxes(
  wages: { user: number; partner?: number },
  filingStatus: TaxFilingStatus,
  policy: TaxPolicy = DEFAULT_TAX_POLICY,
): PayrollTaxBreakdown {
  const userWages = Math.max(0, wages.user);
  const partnerWages = Math.max(0, wages.partner ?? 0);

  const socialSecurity =
    Math.min(userWages, policy.socialSecurityWageBase) * policy.socialSecurityRate +
    Math.min(partnerWages, policy.socialSecurityWageBase) * policy.socialSecurityRate;

  const medicare = (userWages + partnerWages) * policy.medicareRate;

  const threshold = policy.additionalMedicareThreshold[filingStatus];
  const additionalMedicare =
    Math.max(0, userWages + partnerWages - threshold) * policy.additionalMedicareRate;

  const total = socialSecurity + medicare + additionalMedicare;

  return {
    socialSecurity: round2(socialSecurity),
    medicare: round2(medicare),
    additionalMedicare: round2(additionalMedicare),
    total: round2(total),
  };
}


"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  buildPlanStateFromForm,
  loadBaselineFromStorage,
  saveBaselineToStorage,
  validateBaselineForm,
  parseNum,
  getDefaultFormState,
  type BaselineFormState,
} from "@/app/planStateStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StepId = "basics" | "tax_retirement" | "balance_debt";

function stepIndex(step: StepId): number {
  return step === "basics" ? 0 : step === "tax_retirement" ? 1 : 2;
}

function PercentInput(props: {
  id: string;
  placeholder?: string;
  value: number | "";
  onChange: (next: number | undefined) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={props.id}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(parseNum(e.target.value))}
        className="pr-10"
        inputMode="decimal"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        %
      </span>
    </div>
  );
}

function useStoredFormState(): [BaselineFormState, React.Dispatch<React.SetStateAction<BaselineFormState>>] {
  const [state, setState] = useState<BaselineFormState>(() => {
    const stored = loadBaselineFromStorage();
    if (stored) {
      return {
        startAge: stored.startAge,
        endAge: stored.endAge,
        userBaseAnnual: stored.household.user.income.baseAnnual,
        userBonusAnnual: stored.household.user.income.hasBonus ? (stored.household.user.income.bonusAnnual ?? 0) : 0,
        incomeGrowthRate: stored.household.user.income.incomeGrowthRate * 100,
        userHasRetirement: stored.household.user.income.retirement?.hasPlan ?? false,
        userRetirementPreTaxPct: stored.household.user.income.retirement?.employeePreTaxContributionPct ?? 0,
        userRetirementRothPct: stored.household.user.income.retirement?.employeeRothContributionPct ?? 0,
        userHasEmployerMatch: stored.household.user.income.retirement?.hasEmployerMatch ?? false,
        userEmployerMatchPct: stored.household.user.income.retirement?.employerMatchPct ?? 0,
        userEmployerMatchUpToPct: stored.household.user.income.retirement?.employerMatchUpToPct ?? 0,
        hasPartner: stored.household.hasPartner,
        partnerBaseAnnual: stored.household.partner?.income.baseAnnual ?? 0,
        partnerBonusAnnual: stored.household.partner?.income.hasBonus ? (stored.household.partner?.income.bonusAnnual ?? 0) : 0,
        partnerHasRetirement: stored.household.partner?.income.retirement?.hasPlan ?? false,
        partnerRetirementPreTaxPct: stored.household.partner?.income.retirement?.employeePreTaxContributionPct ?? 0,
        partnerRetirementRothPct: stored.household.partner?.income.retirement?.employeeRothContributionPct ?? 0,
        partnerHasEmployerMatch: stored.household.partner?.income.retirement?.hasEmployerMatch ?? false,
        partnerEmployerMatchPct: stored.household.partner?.income.retirement?.employerMatchPct ?? 0,
        partnerEmployerMatchUpToPct: stored.household.partner?.income.retirement?.employerMatchUpToPct ?? 0,
        userPreTaxDeductionsMonthly: stored.household.user.income.preTaxDeductionsMonthly ?? 0,
        partnerPreTaxDeductionsMonthly: stored.household.partner?.income.preTaxDeductionsMonthly ?? 0,
        filingStatus:
          stored.household.tax?.filingStatus ?? (stored.household.hasPartner ? "marriedJoint" : "single"),
        lifestyleMonthly: stored.expenses.mode === "total" ? stored.expenses.lifestyleMonthly : 0,
        housingMonthly: stored.household.housing.status === "rent" ? stored.household.housing.monthlyRent : 0,
        debtBalance: stored.debt[0]?.balance ?? 0,
        debtAprPct: stored.debt[0]?.aprPct ?? 0,
        debtMonthlyPayment: stored.debt[0]?.monthlyPayment ?? 0,
        debtPayoffYearMonth: stored.debt[0]?.payoffYearMonth,
        assetsCash: stored.balanceSheet.assets.find((a) => a.type === "cash")?.balance ?? 0,
        assetsInvestments: stored.balanceSheet.assets.filter((a) => a.type !== "cash").reduce((s, a) => s + a.balance, 0),
        homeValue: stored.balanceSheet.home.currentValue,
        inflationRate: stored.assumptions.inflationRate * 100,
        returnRate: stored.assumptions.returnRate * 100,
        cashRate: stored.assumptions.cashRate * 100,
        flatTaxRate: stored.assumptions.flatTaxRate * 100,
        stateTaxRate: stored.assumptions.stateTaxRate * 100,
      };
    }
    return getDefaultFormState();
  });
  return [state, setState];
}

export default function BaselineWizardPage() {
  const router = useRouter();
  const [form, setForm] = useStoredFormState();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("basics");

  const progressPct = useMemo(() => ((stepIndex(step) + 1) / 3) * 100, [step]);

  function update<K extends keyof BaselineFormState>(k: K, v: BaselineFormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function nextStep() {
    setError(null);
    if (step === "basics") setStep("tax_retirement");
    else if (step === "tax_retirement") setStep("balance_debt");
  }

  function prevStep() {
    setError(null);
    if (step === "balance_debt") setStep("tax_retirement");
    else if (step === "tax_retirement") setStep("basics");
  }

  function saveAndContinue() {
    const msg = validateBaselineForm(form);
    if (msg) {
      setError(msg);
      return;
    }
    const plan = buildPlanStateFromForm(form);
    saveBaselineToStorage(plan);
    router.push("/dashboard");
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%),radial-gradient(circle_at_right,rgba(16,185,129,0.16),transparent_45%)]" />

      <div className="mx-auto max-w-3xl">
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <div className="h-1 w-full bg-muted/40">
            <div className="h-1 bg-foreground" style={{ width: `${progressPct}%` }} />
          </div>
          <CardHeader className="text-center">
            <CardTitle>Let&apos;s start with the basics</CardTitle>
            <CardDescription>We just need a few numbers to build your base plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {step === "basics" ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startAge">Current age</Label>
                    <Input id="startAge" value={form.startAge ?? ""} onChange={(e) => update("startAge", parseNum(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endAge">End age</Label>
                    <Input id="endAge" value={form.endAge ?? ""} onChange={(e) => update("endAge", parseNum(e.target.value))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userBaseAnnual">Base salary (pre-tax, annual)</Label>
                  <Input
                    id="userBaseAnnual"
                    placeholder="85000"
                    value={form.userBaseAnnual ?? ""}
                    onChange={(e) => update("userBaseAnnual", parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userBonusAnnual">Annual bonus (pre-tax)</Label>
                  <Input
                    id="userBonusAnnual"
                    placeholder="0"
                    value={form.userBonusAnnual ?? ""}
                    onChange={(e) => update("userBonusAnnual", parseNum(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Same growth rate as base unless overridden in scenarios.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">Include partner</div>
                    <div className="text-xs text-muted-foreground">Add partner income and settings.</div>
                  </div>
                  <Switch
                    checked={form.hasPartner ?? false}
                    onCheckedChange={(v) => update("hasPartner", v)}
                  />
                </div>

                {form.hasPartner ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="partnerBaseAnnual">Partner base salary (pre-tax, annual)</Label>
                      <Input
                        id="partnerBaseAnnual"
                        placeholder="85000"
                        value={form.partnerBaseAnnual ?? ""}
                        onChange={(e) => update("partnerBaseAnnual", parseNum(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partnerBonusAnnual">Partner annual bonus (pre-tax)</Label>
                      <Input
                        id="partnerBonusAnnual"
                        placeholder="0"
                        value={form.partnerBonusAnnual ?? ""}
                        onChange={(e) => update("partnerBonusAnnual", parseNum(e.target.value))}
                      />
                    </div>
                  </>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lifestyleMonthly">Monthly lifestyle</Label>
                    <Input
                      id="lifestyleMonthly"
                      placeholder="5000"
                      value={form.lifestyleMonthly ?? ""}
                      onChange={(e) => update("lifestyleMonthly", parseNum(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="housingMonthly">Monthly rent</Label>
                    <Input
                      id="housingMonthly"
                      placeholder="2500"
                      value={form.housingMonthly ?? ""}
                      onChange={(e) => update("housingMonthly", parseNum(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {step === "tax_retirement" ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Filing status</Label>
                  <Select
                    value={form.filingStatus ?? "single"}
                    onValueChange={(v) =>
                      update("filingStatus", v === "marriedJoint" ? "marriedJoint" : "single")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select filing status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="marriedJoint">Married filing jointly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="stateTaxRate">State tax rate</Label>
                    <PercentInput
                      id="stateTaxRate"
                      placeholder="5"
                      value={form.stateTaxRate ?? ""}
                      onChange={(v) => update("stateTaxRate", v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incomeGrowthRate">Income growth rate</Label>
                    <PercentInput
                      id="incomeGrowthRate"
                      placeholder="3"
                      value={form.incomeGrowthRate ?? ""}
                      onChange={(v) => update("incomeGrowthRate", v)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/10 p-4">
                  <div className="text-sm font-medium">Retirement (you)</div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-sm">Has plan</div>
                      <Switch
                        checked={form.userHasRetirement ?? false}
                        onCheckedChange={(v) => update("userHasRetirement", v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userPreTaxDed">Pre-tax deductions (monthly)</Label>
                      <Input
                        id="userPreTaxDed"
                        value={form.userPreTaxDeductionsMonthly ?? ""}
                        onChange={(e) => update("userPreTaxDeductionsMonthly", parseNum(e.target.value))}
                      />
                    </div>
                  </div>

                  {form.userHasRetirement ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="userRetPre">Pre-tax %</Label>
                        <PercentInput
                          id="userRetPre"
                          placeholder="10"
                          value={form.userRetirementPreTaxPct ?? ""}
                          onChange={(v) => update("userRetirementPreTaxPct", v)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="userRetRoth">Roth %</Label>
                        <PercentInput
                          id="userRetRoth"
                          placeholder="0"
                          value={form.userRetirementRothPct ?? ""}
                          onChange={(v) => update("userRetirementRothPct", v)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 sm:col-span-2">
                        <div className="text-sm">Employer match</div>
                        <Switch
                          checked={form.userHasEmployerMatch ?? false}
                          onCheckedChange={(v) => update("userHasEmployerMatch", v)}
                        />
                      </div>
                      {form.userHasEmployerMatch ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="userMatchPct">Match %</Label>
                            <PercentInput
                              id="userMatchPct"
                              placeholder="50"
                              value={form.userEmployerMatchPct ?? ""}
                              onChange={(v) => update("userEmployerMatchPct", v)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="userUpToPct">Up to %</Label>
                            <PercentInput
                              id="userUpToPct"
                              placeholder="6"
                              value={form.userEmployerMatchUpToPct ?? ""}
                              onChange={(v) => update("userEmployerMatchUpToPct", v)}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {form.hasPartner ? (
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="text-sm font-medium">Retirement (partner)</div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                        <div className="text-sm">Has plan</div>
                        <Switch
                          checked={form.partnerHasRetirement ?? false}
                          onCheckedChange={(v) => update("partnerHasRetirement", v)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="partnerPreTaxDed">Pre-tax deductions (monthly)</Label>
                        <Input
                          id="partnerPreTaxDed"
                          value={form.partnerPreTaxDeductionsMonthly ?? ""}
                          onChange={(e) => update("partnerPreTaxDeductionsMonthly", parseNum(e.target.value))}
                        />
                      </div>
                    </div>
                    {form.partnerHasRetirement ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="partnerRetPre">Pre-tax %</Label>
                          <PercentInput
                            id="partnerRetPre"
                            placeholder="0"
                            value={form.partnerRetirementPreTaxPct ?? ""}
                            onChange={(v) => update("partnerRetirementPreTaxPct", v)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="partnerRetRoth">Roth %</Label>
                          <PercentInput
                            id="partnerRetRoth"
                            placeholder="0"
                            value={form.partnerRetirementRothPct ?? ""}
                            onChange={(v) => update("partnerRetirementRothPct", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 sm:col-span-2">
                          <div className="text-sm">Employer match</div>
                          <Switch
                            checked={form.partnerHasEmployerMatch ?? false}
                            onCheckedChange={(v) => update("partnerHasEmployerMatch", v)}
                          />
                        </div>
                        {form.partnerHasEmployerMatch ? (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="partnerMatchPct">Match %</Label>
                              <PercentInput
                                id="partnerMatchPct"
                                placeholder="50"
                                value={form.partnerEmployerMatchPct ?? ""}
                                onChange={(v) => update("partnerEmployerMatchPct", v)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="partnerUpToPct">Up to %</Label>
                              <PercentInput
                                id="partnerUpToPct"
                                placeholder="6"
                                value={form.partnerEmployerMatchUpToPct ?? ""}
                                onChange={(v) => update("partnerEmployerMatchUpToPct", v)}
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === "balance_debt" ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Starting assets</Label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="assetsCash" className="text-xs text-muted-foreground">
                        Cash &amp; taxable
                      </Label>
                      <Input
                        id="assetsCash"
                        value={form.assetsCash ?? ""}
                        onChange={(e) => update("assetsCash", parseNum(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assetsInvestments" className="text-xs text-muted-foreground">
                        Investments (non-cash)
                      </Label>
                      <Input
                        id="assetsInvestments"
                        value={form.assetsInvestments ?? ""}
                        onChange={(e) => update("assetsInvestments", parseNum(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Debt (one loan, v1)</Label>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="debtBalance" className="text-xs text-muted-foreground">
                        Balance
                      </Label>
                      <Input
                        id="debtBalance"
                        value={form.debtBalance ?? ""}
                        onChange={(e) => update("debtBalance", parseNum(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="debtAprPct" className="text-xs text-muted-foreground">
                        APR %
                      </Label>
                      <PercentInput
                        id="debtAprPct"
                        placeholder="6.5"
                        value={form.debtAprPct ?? ""}
                        onChange={(v) => update("debtAprPct", v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="debtMonthlyPayment" className="text-xs text-muted-foreground">
                        Monthly payment
                      </Label>
                      <Input
                        id="debtMonthlyPayment"
                        value={form.debtMonthlyPayment ?? ""}
                        onChange={(e) => update("debtMonthlyPayment", parseNum(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="returnRate">Investment return</Label>
                    <PercentInput
                      id="returnRate"
                      placeholder="7"
                      value={form.returnRate ?? ""}
                      onChange={(v) => update("returnRate", v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cashRate">Cash return</Label>
                    <PercentInput
                      id="cashRate"
                      placeholder="4"
                      value={form.cashRate ?? ""}
                      onChange={(v) => update("cashRate", v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inflationRate">Inflation</Label>
                    <PercentInput
                      id="inflationRate"
                      placeholder="2.5"
                      value={form.inflationRate ?? ""}
                      onChange={(v) => update("inflationRate", v)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button asChild variant="ghost" className="rounded-2xl">
                <Link href="/">Back</Link>
              </Button>

              <div className="flex items-center gap-2">
                {step !== "basics" ? (
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={prevStep}>
                    Back
                  </Button>
                ) : null}
                {step !== "balance_debt" ? (
                  <Button type="button" className="rounded-2xl" onClick={nextStep}>
                    Next Step →
                  </Button>
                ) : (
                  <Button type="button" className="rounded-2xl" onClick={saveAndContinue}>
                    Next Step →
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your baseline is saved locally in your browser. You can revise it any time.
        </p>
      </div>
    </div>
  );
}


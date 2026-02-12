"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
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
import {
  buildPlanStateFromForm,
  loadBaselineFromStorage,
  saveBaselineToStorage,
  validateBaselineForm,
  parseNum,
  getDefaultFormState,
  type BaselineFormState,
} from "./planStateStorage";

function useStoredFormState(): [BaselineFormState, import("./planStateStorage").SetBaselineFormState] {
  const [state, setState] = useState<BaselineFormState>(() => {
    const stored = loadBaselineFromStorage();
    if (stored) {
      return {
        startAge: stored.startAge,
        endAge: stored.endAge,
        userBaseAnnual: stored.household.user.income.baseAnnual,
        incomeGrowthRate: stored.household.user.income.incomeGrowthRate,
        userHasRetirement: stored.household.user.income.retirement?.hasPlan ?? false,
        userRetirementPreTaxPct:
          stored.household.user.income.retirement?.employeePreTaxContributionPct ?? 0,
        userRetirementRothPct:
          stored.household.user.income.retirement?.employeeRothContributionPct ?? 0,
        userHasEmployerMatch: stored.household.user.income.retirement?.hasEmployerMatch ?? false,
        userEmployerMatchPct: stored.household.user.income.retirement?.employerMatchPct ?? 0,
        userEmployerMatchUpToPct: stored.household.user.income.retirement?.employerMatchUpToPct ?? 0,
        hasPartner: stored.household.hasPartner,
        partnerBaseAnnual: stored.household.partner?.income.baseAnnual ?? 0,
        partnerHasRetirement: stored.household.partner?.income.retirement?.hasPlan ?? false,
        partnerRetirementPreTaxPct:
          stored.household.partner?.income.retirement?.employeePreTaxContributionPct ?? 0,
        partnerRetirementRothPct:
          stored.household.partner?.income.retirement?.employeeRothContributionPct ?? 0,
        partnerHasEmployerMatch:
          stored.household.partner?.income.retirement?.hasEmployerMatch ?? false,
        partnerEmployerMatchPct:
          stored.household.partner?.income.retirement?.employerMatchPct ?? 0,
        partnerEmployerMatchUpToPct:
          stored.household.partner?.income.retirement?.employerMatchUpToPct ?? 0,
        userPreTaxDeductionsMonthly: stored.household.user.income.preTaxDeductionsMonthly ?? 0,
        partnerPreTaxDeductionsMonthly:
          stored.household.partner?.income.preTaxDeductionsMonthly ?? 0,
        filingStatus: stored.household.tax?.filingStatus ?? (stored.household.hasPartner ? "marriedJoint" : "single"),
        lifestyleMonthly: stored.expenses.mode === "total" ? stored.expenses.lifestyleMonthly : 0,
        housingMonthly: stored.household.housing.status === "rent" ? stored.household.housing.monthlyRent : 0,
        debtBalance: stored.debt[0]?.balance ?? 0,
        debtAprPct: stored.debt[0]?.aprPct ?? 0,
        debtMonthlyPayment: stored.debt[0]?.monthlyPayment ?? 0,
        debtPayoffYearMonth: stored.debt[0]?.payoffYearMonth,
        assetsCash: stored.balanceSheet.assets.find((a) => a.type === "cash")?.balance ?? 0,
        assetsInvestments: stored.balanceSheet.assets
          .filter((a) => a.type !== "cash")
          .reduce((s, a) => s + a.balance, 0),
        homeValue: stored.balanceSheet.home.currentValue,
        inflationRate: stored.assumptions.inflationRate,
        returnRate: stored.assumptions.returnRate,
        cashRate: stored.assumptions.cashRate,
        flatTaxRate: stored.assumptions.flatTaxRate,
        stateTaxRate: stored.assumptions.stateTaxRate,
      };
    }
    return getDefaultFormState();
  });
  return [state, setState];
}

export default function BaselineInputsPage() {
  const router = useRouter();
  const [form, setForm] = useStoredFormState();
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof BaselineFormState>(key: K, value: BaselineFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, [setForm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateBaselineForm(form);
    if (err) {
      setError(err);
      return;
    }
    const plan = buildPlanStateFromForm(form);
    saveBaselineToStorage(plan);
    router.push("/results");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planlife</h1>
          <p className="text-muted-foreground text-sm">Baseline inputs</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Projection window</CardTitle>
              <CardDescription>Start and end age for the simulation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startAge">Start age</Label>
                  <Input
                    id="startAge"
                    type="number"
                    min={18}
                    max={100}
                    value={form.startAge ?? ""}
                    onChange={(e) => update("startAge", parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endAge">End age</Label>
                  <Input
                    id="endAge"
                    type="number"
                    min={18}
                    max={120}
                    value={form.endAge ?? ""}
                    onChange={(e) => update("endAge", parseNum(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your income</CardTitle>
              <CardDescription>Annual base salary and retirement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userBaseAnnual">Base annual income ($)</Label>
                <Input
                  id="userBaseAnnual"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.userBaseAnnual ?? ""}
                  onChange={(e) => update("userBaseAnnual", parseNum(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Retirement plan (401k etc.)</Label>
                  <p className="text-muted-foreground text-xs">Split between pre-tax and Roth</p>
                </div>
                <Switch
                  checked={form.userHasRetirement ?? false}
                  onCheckedChange={(v) => update("userHasRetirement", v)}
                />
              </div>
              {form.userHasRetirement && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="userRetirementPreTaxPct">Pre-tax %</Label>
                      <Input
                        id="userRetirementPreTaxPct"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={form.userRetirementPreTaxPct ?? ""}
                        onChange={(e) =>
                          update("userRetirementPreTaxPct", parseNum(e.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userRetirementRothPct">Roth %</Label>
                      <Input
                        id="userRetirementRothPct"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={form.userRetirementRothPct ?? ""}
                        onChange={(e) =>
                          update("userRetirementRothPct", parseNum(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Employer match</Label>
                      <p className="text-muted-foreground text-xs">
                        Match % is applied to total employee % (pre-tax + Roth)
                      </p>
                    </div>
                    <Switch
                      checked={form.userHasEmployerMatch ?? false}
                      onCheckedChange={(v) => update("userHasEmployerMatch", v)}
                    />
                  </div>

                  {form.userHasEmployerMatch && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="userEmployerMatchPct">Match % (e.g. 50 = 50%)</Label>
                        <Input
                          id="userEmployerMatchPct"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={form.userEmployerMatchPct ?? ""}
                          onChange={(e) =>
                            update("userEmployerMatchPct", parseNum(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="userEmployerMatchUpToPct">Up to % of pay (e.g. 6)</Label>
                        <Input
                          id="userEmployerMatchUpToPct"
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={form.userEmployerMatchUpToPct ?? ""}
                          onChange={(e) =>
                            update("userEmployerMatchUpToPct", parseNum(e.target.value))
                          }
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="incomeGrowthRate">Income growth rate (e.g. 0.03 = 3%)</Label>
                <Input
                  id="incomeGrowthRate"
                  type="number"
                  min={0}
                  max={0.2}
                  step={0.01}
                  value={form.incomeGrowthRate ?? ""}
                  onChange={(e) => update("incomeGrowthRate", parseNum(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userPreTaxDeductionsMonthly">
                  Pre-tax deductions (monthly $)
                </Label>
                <p className="text-muted-foreground text-xs">
                  Health/vision/dental, commuter benefits, etc. (reduces taxable income and FICA wages)
                </p>
                <Input
                  id="userPreTaxDeductionsMonthly"
                  type="number"
                  min={0}
                  step={25}
                  value={form.userPreTaxDeductionsMonthly ?? ""}
                  onChange={(e) =>
                    update("userPreTaxDeductionsMonthly", parseNum(e.target.value))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Taxes</CardTitle>
              <CardDescription>Filing status for bracket + FICA thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>Filing status</Label>
              <Select
                value={form.filingStatus ?? (form.hasPartner ? "marriedJoint" : "single")}
                onValueChange={(v) => update("filingStatus", v as BaselineFormState["filingStatus"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select filing status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="marriedJoint">Married filing jointly</SelectItem>
                </SelectContent>
              </Select>

              <div className="pt-4 space-y-2">
                <Label htmlFor="stateTaxRate">State tax rate (e.g. 0.05 = 5%)</Label>
                <Input
                  id="stateTaxRate"
                  type="number"
                  min={0}
                  max={0.2}
                  step={0.005}
                  value={form.stateTaxRate ?? ""}
                  onChange={(e) => update("stateTaxRate", parseNum(e.target.value))}
                />
                <p className="text-muted-foreground text-xs">
                  Placeholder flat rate applied to taxable income after standard deduction.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Partner</CardTitle>
              <CardDescription>Optional second income</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Include partner</Label>
                <Switch
                  checked={form.hasPartner ?? false}
                  onCheckedChange={(v) => {
                    update("hasPartner", v);
                    // v1 default: if partner is enabled, default to MFJ; otherwise Single.
                    update("filingStatus", v ? "marriedJoint" : "single");
                  }}
                />
              </div>
              {form.hasPartner && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="partnerBaseAnnual">Partner base annual income ($)</Label>
                    <Input
                      id="partnerBaseAnnual"
                      type="number"
                      min={0}
                      step={1000}
                      value={form.partnerBaseAnnual ?? ""}
                      onChange={(e) => update("partnerBaseAnnual", parseNum(e.target.value))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Partner retirement plan</Label>
                      <p className="text-muted-foreground text-xs">Split between pre-tax and Roth</p>
                    </div>
                    <Switch
                      checked={form.partnerHasRetirement ?? false}
                      onCheckedChange={(v) => update("partnerHasRetirement", v)}
                    />
                  </div>

                  {form.partnerHasRetirement && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="partnerRetirementPreTaxPct">Pre-tax %</Label>
                          <Input
                            id="partnerRetirementPreTaxPct"
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={form.partnerRetirementPreTaxPct ?? ""}
                            onChange={(e) =>
                              update("partnerRetirementPreTaxPct", parseNum(e.target.value))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="partnerRetirementRothPct">Roth %</Label>
                          <Input
                            id="partnerRetirementRothPct"
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={form.partnerRetirementRothPct ?? ""}
                            onChange={(e) =>
                              update("partnerRetirementRothPct", parseNum(e.target.value))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Partner employer match</Label>
                          <p className="text-muted-foreground text-xs">
                            Match checks total employee % (pre-tax + Roth)
                          </p>
                        </div>
                        <Switch
                          checked={form.partnerHasEmployerMatch ?? false}
                          onCheckedChange={(v) => update("partnerHasEmployerMatch", v)}
                        />
                      </div>

                      {form.partnerHasEmployerMatch && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="partnerEmployerMatchPct">Match %</Label>
                            <Input
                              id="partnerEmployerMatchPct"
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={form.partnerEmployerMatchPct ?? ""}
                              onChange={(e) =>
                                update("partnerEmployerMatchPct", parseNum(e.target.value))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="partnerEmployerMatchUpToPct">Up to % of pay</Label>
                            <Input
                              id="partnerEmployerMatchUpToPct"
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={form.partnerEmployerMatchUpToPct ?? ""}
                              onChange={(e) =>
                                update("partnerEmployerMatchUpToPct", parseNum(e.target.value))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="partnerPreTaxDeductionsMonthly">
                      Partner pre-tax deductions (monthly $)
                    </Label>
                    <Input
                      id="partnerPreTaxDeductionsMonthly"
                      type="number"
                      min={0}
                      step={25}
                      value={form.partnerPreTaxDeductionsMonthly ?? ""}
                      onChange={(e) =>
                        update("partnerPreTaxDeductionsMonthly", parseNum(e.target.value))
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses & housing</CardTitle>
              <CardDescription>Monthly lifestyle and rent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lifestyleMonthly">Lifestyle monthly ($)</Label>
                <Input
                  id="lifestyleMonthly"
                  type="number"
                  min={0}
                  step={100}
                  value={form.lifestyleMonthly ?? ""}
                  onChange={(e) => update("lifestyleMonthly", parseNum(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="housingMonthly">Housing monthly / rent ($)</Label>
                <Input
                  id="housingMonthly"
                  type="number"
                  min={0}
                  step={100}
                  value={form.housingMonthly ?? ""}
                  onChange={(e) => update("housingMonthly", parseNum(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debt (one loan)</CardTitle>
              <CardDescription>Balance, APR, and monthly payment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="debtBalance">Balance ($)</Label>
                  <Input
                    id="debtBalance"
                    type="number"
                    min={0}
                    value={form.debtBalance ?? ""}
                    onChange={(e) => update("debtBalance", parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debtAprPct">APR %</Label>
                  <Input
                    id="debtAprPct"
                    type="number"
                    min={0}
                    step={0.1}
                    value={form.debtAprPct ?? ""}
                    onChange={(e) => update("debtAprPct", parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debtMonthlyPayment">Monthly payment ($)</Label>
                  <Input
                    id="debtMonthlyPayment"
                    type="number"
                    min={0}
                    value={form.debtMonthlyPayment ?? ""}
                    onChange={(e) => update("debtMonthlyPayment", parseNum(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="debtPayoffYearMonth">Payoff by (YYYY-MM)</Label>
                <Input
                  id="debtPayoffYearMonth"
                  type="text"
                  placeholder="2028-06"
                  value={form.debtPayoffYearMonth ?? ""}
                  onChange={(e) => update("debtPayoffYearMonth", e.target.value as BaselineFormState["debtPayoffYearMonth"])}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
              <CardDescription>Cash and investments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assetsCash">Cash ($)</Label>
                  <Input
                    id="assetsCash"
                    type="number"
                    min={0}
                    value={form.assetsCash ?? ""}
                    onChange={(e) => update("assetsCash", parseNum(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assetsInvestments">Investments ($)</Label>
                  <Input
                    id="assetsInvestments"
                    type="number"
                    min={0}
                    value={form.assetsInvestments ?? ""}
                    onChange={(e) => update("assetsInvestments", parseNum(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="homeValue">Home value ($, 0 if renting)</Label>
                <Input
                  id="homeValue"
                  type="number"
                  min={0}
                  value={form.homeValue ?? ""}
                  onChange={(e) => update("homeValue", parseNum(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="submit">Run projection →</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

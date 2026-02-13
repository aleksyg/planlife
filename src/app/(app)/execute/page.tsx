"use client";

import Link from "next/link";
import { useMemo } from "react";
import { loadBaselineFromStorage } from "@/app/planStateStorage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExecutePage() {
  const plan = useMemo(() => loadBaselineFromStorage(), []);

  if (!plan) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Execute</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter baseline inputs first.</p>
        <Button asChild className="mt-6 rounded-2xl px-7">
          <Link href="/baseline">Get started</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Your Action Plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A simple order for where your next dollars often go, based on your goals. (Placeholder)
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Priority for February</div>
        <div className="mt-2 text-2xl font-semibold">Pay off Student Loan B</div>
        <div className="mt-1 text-sm opacity-90">
          Based on the “Avalanche Method”, targeting this 6.8% rate debt saves you the most interest.
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-white/10 p-4">
          <div className="text-sm opacity-90">Extra payment</div>
          <div className="text-2xl font-semibold">$450</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Roadmap</CardTitle>
          <CardDescription>Static placeholders until we wire optimization logic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <div className="text-sm font-medium">Build Emergency Fund</div>
            <div className="mt-1 text-xs text-muted-foreground">3 months of expenses saved in HYSA.</div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-indigo-900">High-Interest Debt</div>
                <div className="mt-1 text-xs text-indigo-900/70">Pay down loans above ~6% interest.</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs text-indigo-900 shadow-sm">
                Est. completion: Oct 2026
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/10 p-4 opacity-60">
            <div className="text-sm font-medium">Max 401k Match</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Contribute enough to get full employer match.
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/10 p-4 opacity-60">
            <div className="text-sm font-medium">Balance tax-advantaged vs near-term goals</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Split surplus between 401k/IRA/HSA and savings for upcoming goals.
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/10 p-4 opacity-60">
            <div className="text-sm font-medium">After-tax investing</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Invest remaining surplus in a taxable brokerage account.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


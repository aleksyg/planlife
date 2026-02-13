"use client";

import Link from "next/link";
import { useState } from "react";
import { simulatePlan } from "@/engine";
import type { YearRow } from "@/engine";
import { loadBaselineFromStorage } from "@/app/planStateStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectionBars } from "@/components/app/ProjectionBars";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DashboardPage() {
  const plan = loadBaselineFromStorage();
  const rows: YearRow[] = plan ? simulatePlan(plan) : [];

  const [focusYearIndex, setFocusYearIndex] = useState<string>("0");
  const focusRow = rows[Number(focusYearIndex)] ?? rows[0];
  const lastRow = rows[rows.length - 1];

  if (!plan) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start by entering your baseline numbers.
        </p>
        <Button asChild className="mt-6 rounded-2xl px-7">
          <Link href="/baseline">Get started</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Your plan at{" "}
          <span className="inline-flex items-center align-middle">
            <Select value={focusYearIndex} onValueChange={setFocusYearIndex}>
              <SelectTrigger className="h-10 w-[140px] rounded-2xl border-0 bg-transparent px-0 text-indigo-600 shadow-none hover:bg-transparent focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Focus age" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.yearIndex} value={String(r.yearIndex)}>
                    Age {r.age}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Based on your inputs. Focus Age:{" "}
          <span className="font-medium text-foreground">{focusRow?.age ?? "—"}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net worth</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(focusRow?.endNetWorth ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assets</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(focusRow?.endAssetValue ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Annual savings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(focusRow?.annualSavings ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxes (year 0)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(rows[0]?.taxesPaid ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Projection preview</CardTitle>
            <CardDescription>Net worth growth over time</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href="/dashboard/chart">Expand chart</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectionBars rows={rows} highlightYearIndex={Number(focusYearIndex)} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Final age {lastRow?.age}: <span className="font-medium text-foreground">{formatCurrency(lastRow?.endNetWorth ?? 0)}</span>
            </div>
            <Button asChild variant="ghost" className="h-8 rounded-2xl px-3 text-xs">
              <Link href="/dashboard/chart">View details</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


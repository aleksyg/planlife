"use client";

import Link from "next/link";
import { simulatePlan } from "@/engine";
import type { YearRow } from "@/engine";
import { loadBaselineFromStorage } from "@/app/planStateStorage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectionBars } from "@/components/app/ProjectionBars";

export default function ExpandedChartPage() {
  const plan = loadBaselineFromStorage();
  const rows: YearRow[] = plan ? simulatePlan(plan) : [];

  if (!plan) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm text-muted-foreground">No baseline plan found.</p>
        <Button asChild className="mt-4 rounded-2xl px-7">
          <Link href="/baseline">Enter inputs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Detailed Projection Analysis</h1>
          <p className="text-sm text-muted-foreground">Hover bars for details.</p>
        </div>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/dashboard">Close</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Net worth projection</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectionBars rows={rows} heightClassName="h-[420px]" />
        </CardContent>
      </Card>
    </div>
  );
}


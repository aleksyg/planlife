"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/baseline", label: "Inputs" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/plan", label: "Plan Your Life" },
  { href: "/execute", label: "Execute" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-xs font-semibold">
            P
          </div>
          <span className="text-sm font-semibold tracking-tight">PlanLife</span>
        </Link>

        <div className="hidden items-center gap-1 rounded-full bg-muted/30 p-1 sm:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden text-xs text-muted-foreground sm:block">Last updated: Today</div>
          <Button variant="outline" size="sm">
            Check-in
          </Button>
        </div>
      </div>
    </div>
  );
}


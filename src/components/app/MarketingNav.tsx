import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <div className="bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-xs font-semibold">
            P
          </div>
          <span className="text-sm font-semibold tracking-tight">PlanLife</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link href="#" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="#" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="#" className="hover:text-foreground">
            FAQ
          </Link>
        </div>

        <Button asChild className="rounded-full px-5">
          <Link href="/baseline">Get Started</Link>
        </Button>
      </div>
    </div>
  );
}


import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-14">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          Plan your life{" "}
          <span className="block text-muted-foreground">with confidence.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          See where you’re headed, explore decisions, and get a simple plan for what to do next.
          No spreadsheets, no confusion.
        </p>

        <p className="mt-10 text-sm text-muted-foreground">“Can I afford to work part-time?”</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-2xl px-7 shadow-sm">
            <Link href="/baseline">
              Get started <span className="ml-1">→</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-2xl px-7">
            <Link href="/dashboard">See a sample plan</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-20 grid max-w-5xl gap-6 border-t border-border/60 pt-12 sm:grid-cols-3">
        <div className="flex gap-3">
          <div className="mt-0.5 h-5 w-5 rounded-full border border-indigo-300 bg-indigo-50" />
          <div>
            <div className="text-sm font-semibold">Base Case</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Get a fast initial projection of your net worth and coverage age.
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="mt-0.5 h-5 w-5 rounded-full border border-indigo-300 bg-indigo-50" />
          <div>
            <div className="text-sm font-semibold">Plan Your Life</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Layer on major life decisions like buying a home or having kids.
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="mt-0.5 h-5 w-5 rounded-full border border-indigo-300 bg-indigo-50" />
          <div>
            <div className="text-sm font-semibold">Execute</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Get a clear, next-dollar roadmap for your monthly finances.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


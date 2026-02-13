import type { ReactNode } from "react";
import { MarketingNav } from "@/components/app/MarketingNav";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNav />
      {children}
    </div>
  );
}


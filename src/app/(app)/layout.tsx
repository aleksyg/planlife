import type { ReactNode } from "react";
import { AppNav } from "@/components/app/AppNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
    </div>
  );
}


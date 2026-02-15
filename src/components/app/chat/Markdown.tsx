"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown(props: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:my-2",
        "prose-pre:rounded-lg prose-pre:bg-muted/40 prose-pre:p-3",
        "prose-code:rounded prose-code:bg-muted/30 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.85em]",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        props.className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.content}</ReactMarkdown>
    </div>
  );
}


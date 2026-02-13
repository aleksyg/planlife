"use client";

import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import type { ChatMessage } from "./types";

export function MessageBubble(props: { message: ChatMessage } | { role: "assistant" | "user"; content: string }) {
  const role = "message" in props ? props.message.role : props.role;
  const content = "message" in props ? props.message.content : props.content;
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70ch] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-muted/60 text-foreground"
            : "bg-muted/30 text-foreground",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <Markdown content={content} />
        )}
      </div>
    </div>
  );
}


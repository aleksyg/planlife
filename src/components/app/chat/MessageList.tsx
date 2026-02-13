"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";
import { MessageBubble } from "./MessageBubble";

export function MessageList(props: {
  messages: readonly ChatMessage[];
  isTyping?: boolean;
  belowMessages?: ReactNode;
  onScrollStateChange?: (isAtBottom: boolean) => void;
  scrollToBottomSignal?: number;
}) {
  const { messages, isTyping, belowMessages, onScrollStateChange, scrollToBottomSignal } = props;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const lastMessageId = useMemo(() => messages[messages.length - 1]?.id ?? "", [messages]);

  function computeIsAtBottom(el: HTMLDivElement): boolean {
    const thresholdPx = 64;
    return el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx;
  }

  function scrollToBottom(behavior: ScrollBehavior) {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }

  useEffect(() => {
    // When parent explicitly signals, force scroll (used by Jump-to-latest).
    if (!scrollToBottomSignal) return;
    scrollToBottom("smooth");
  }, [scrollToBottomSignal]);

  useEffect(() => {
    // When messages change, scroll if user is at bottom.
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = computeIsAtBottom(el);
    if (atBottom) scrollToBottom("auto");
    onScrollStateChange?.(atBottom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId, isTyping]);

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "relative flex-1 overflow-y-auto px-4 py-5 sm:px-6",
      )}
      onScroll={() => {
        const el = scrollerRef.current;
        if (!el) return;
        onScrollStateChange?.(computeIsAtBottom(el));
      }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {isTyping ? (
          <MessageBubble
            role="assistant"
            content={"Typing…"}
          />
        ) : null}

        {belowMessages}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}


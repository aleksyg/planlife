"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatComposer(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { value, onChange, onSend, disabled, placeholder } = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => !disabled && value.trim().length > 0, [disabled, value]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend();
  }, [canSend, onSend]);

  // Keep focus after sending.
  useEffect(() => {
    if (disabled) return;
    textareaRef.current?.focus();
  }, [disabled]);

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-3 sm:px-6">
        <textarea
          ref={textareaRef}
          className={cn(
            "min-h-[44px] max-h-40 w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          placeholder={placeholder ?? 'Describe a scenario…'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          type="button"
          className="h-11 rounded-2xl px-5"
          onClick={handleSend}
          disabled={!canSend}
        >
          Send
        </Button>
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-3 text-xs text-muted-foreground sm:px-6">
        Enter to send, Shift+Enter for a new line.
      </div>
    </div>
  );
}


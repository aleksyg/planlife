"use client";

import type { LifeEvent } from "@/scenario/lifeEvents/types";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LifeEventCardProps = {
  event: LifeEvent;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onClick?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const MAX_SUMMARY_LINES = 3;

export function LifeEventCard({ event, onToggleEnabled, onClick, onDelete }: LifeEventCardProps) {
  const visibleSummary = event.summary.slice(0, MAX_SUMMARY_LINES);
  const remainingCount = event.summary.length - MAX_SUMMARY_LINES;

  const handleCardClick = () => {
    onClick?.(event.id);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(event.id);
  };

  return (
    <Card
      className={cn(
        "cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/30",
        !event.enabled && "opacity-60",
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{event.title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={handleToggleClick}>
          <Switch
            checked={event.enabled}
            onCheckedChange={(checked) => onToggleEnabled(event.id, checked)}
          />
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDeleteClick}
              aria-label="Remove"
            >
              ×
            </Button>
          ) : null}
        </div>
      </div>
      {event.summary.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          {visibleSummary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          {remainingCount > 0 ? (
            <li
              key="more"
              className="list-none italic"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              +{remainingCount} more
            </li>
          ) : null}
        </ul>
      ) : null}
    </Card>
  );
}

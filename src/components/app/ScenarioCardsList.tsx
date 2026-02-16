"use client";

import { useState } from "react";
import type { ScenarioCard } from "@/scenario/modifiers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScenarioCardsList(props: {
  cards: ScenarioCard[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const { cards, onToggle, onDelete, onEdit } = props;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (cards.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Scenario changes</div>
      <ul className="space-y-2">
        {cards.map((card) => {
          const isExpanded = expandedId === card.id;
          return (
            <li
              key={card.id}
              className={cn(
                "rounded-xl border border-border bg-card p-3 shadow-sm transition-colors",
                !card.enabled && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1.5"
                    checked={card.enabled}
                    onChange={(e) => onToggle(card.id, e.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{card.title}</div>
                    {card.summary ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{card.summary}</p>
                    ) : null}
                  </div>
                </label>
                <div className="flex shrink-0 items-center gap-1">
                  {onEdit && card.config ? (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onEdit(card.id)}>
                      Edit
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => onDelete(card.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {card.summary && (
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline"
                  onClick={() => setExpandedId(isExpanded ? null : card.id)}
                >
                  {isExpanded ? "Collapse" : "Show summary"}
                </button>
              )}
              {isExpanded && card.summary ? (
                <div className="mt-2 rounded border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  {card.summary}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { LifeEvent } from "@/scenario/lifeEvents/types";
import { LifeEventModal } from "@/scenario/lifeEvents/LifeEventModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeEventCard } from "@/scenario/LifeEventCard";

export function LifeEventsPanel() {
  const [events, setEvents] = useState<LifeEvent[]>(() => []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingEvent =
    editingId ? events.find((e) => e.id === editingId) ?? null : null;

  const onAddEvent = () => {
    setEditingId(null);
    setIsModalOpen(true);
  };

  const onEditEvent = (id: string) => {
    setEditingId(id);
    setIsModalOpen(true);
  };

  const onCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const onSaveEvent = (evt: LifeEvent) => {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === evt.id);
      if (!exists) return [evt, ...prev];
      return prev.map((e) => (e.id === evt.id ? evt : e));
    });
    onCloseModal();
  };

  const onDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    onCloseModal();
  };

  const onToggleEnabled = (id: string, enabled: boolean) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled } : e)),
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Life Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No life events yet</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id}>
                  <LifeEventCard
                    event={event}
                    onToggleEnabled={onToggleEnabled}
                    onClick={onEditEvent}
                    onDelete={onDeleteEvent}
                  />
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={onAddEvent}
          >
            Add Event
          </Button>
        </CardContent>
      </Card>

      <LifeEventModal
        open={isModalOpen}
        event={editingId ? editingEvent : null}
        onClose={onCloseModal}
        onSave={(evt) => onSaveEvent(evt)}
        onDelete={(id) => onDeleteEvent(id)}
      />
    </>
  );
}

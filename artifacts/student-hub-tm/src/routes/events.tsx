import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader } from "@/components/app/ui-kit";
import { EventCard } from "@/components/app/cards";
import { useI18n } from "@/lib/i18n";
import { events } from "@/lib/demo-data";
import { CalendarHeart } from "lucide-react";
import { getContent, postContent, type EventItem } from "@/lib/content-client";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Student TM" },
      { name: "description", content: "Campus events, workshops and conferences with one-tap registration." },
      { property: "og:title", content: "Events — Student TM" },
      { property: "og:description", content: "Campus events with one-tap registration." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { t } = useI18n();
  const [registered, setRegistered] = useState<Record<string, boolean>>({});
  const [published, setPublished] = useState<EventItem[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getContent<{ items: EventItem[]; registeredEventIds: string[] }>("events")
      .then((response) => {
        if (!active) return;
        setPublished(response.items);
        setRegistered(Object.fromEntries(response.registeredEventIds.map((id) => [id, true])));
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load events.");
      });
    return () => {
      active = false;
    };
  }, []);

  const allEvents = [
    ...published.map(({ body, ...event }) => ({ ...event, description: body })),
    ...events,
  ];

  const registerForEvent = async (eventId: string) => {
    setPendingId(eventId);
    setError("");
    try {
      await postContent<{ registered: boolean }>({ action: "register-event", eventId });
      setRegistered((current) => ({ ...current, [eventId]: true }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to register for the event.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <AppShell allow={["student", "teacher", "admin", "superadmin"]}>
      <PageHeader title={t("nav.events")} />
      {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
      {allEvents.length === 0 ? (
        <EmptyState message={t("empty.events")} icon={<CalendarHeart className="h-6 w-6" />} />
      ) : (
        <div className="space-y-3">
          {allEvents.map((e) => (
            <EventCard
              key={e.id}
              e={e}
              registered={!!registered[e.id]}
              onRegister={() => void registerForEvent(e.id)}
              registering={pendingId === e.id}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

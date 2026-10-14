import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader } from "@/components/app/ui-kit";
import { NotificationItem } from "@/components/app/cards";
import { useI18n } from "@/lib/i18n";
import { Bell } from "lucide-react";
import { getContent, patchContent, type SavedNotification } from "@/lib/content-client";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Student TM" },
      { name: "description", content: "Deadlines, grades, schedule changes, exams and announcements in one place." },
      { property: "og:title", content: "Notifications — Student TM" },
      { property: "og:description", content: "Deadlines, grades and schedule changes in one place." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<SavedNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getContent<{ items: SavedNotification[] }>("notifications")
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load notifications.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const unread = items.filter((n) => !n.read).length;
  const visibleItems = filter === "unread" ? items.filter((n) => !n.read) : items;
  const markRead = async (id: string) => {
    try {
      await patchContent({ notificationId: id });
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update notification.");
    }
  };

  const markAllRead = async () => {
    try {
      await patchContent({ markAll: true });
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update notifications.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={t("nav.notifications")}
        subtitle={`${unread} ${t("notif.unread")}`}
        action={
          unread ? (
            <button
              onClick={() => void markAllRead()}
              className="text-sm font-semibold text-primary"
            >
              {t("notif.markAll")}
            </button>
          ) : undefined
        }
      />
      {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
      <div className="mb-4 inline-flex rounded-xl bg-muted p-1">
        {([['all', 'All'], ['unread', 'Unread']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === value ? "bg-card shadow-soft" : "text-muted-foreground"}`}>{label}{value === "unread" ? ` (${unread})` : ""}</button>)}
      </div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading notifications…</p> : null}
      {!loading && visibleItems.length === 0 ? (
        <EmptyState message={t("empty.notifications")} icon={<Bell className="h-6 w-6" />} />
      ) : null}
      {!loading && visibleItems.length > 0 ? (
        <div className="space-y-3">
          {visibleItems.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              onRead={() => void markRead(n.id)}
            />
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Download,
  FileWarning,
  GraduationCap,
  History,
  Mail,
  Megaphone,
  Presentation,
  Settings2,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ResourceManager, type ResourceItem } from "@/components/admin/resource-manager";
import { LectureMaterialsPanel } from "@/components/teacher/panels";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  deleteContent,
  getContent,
  postContent,
  type PublishedItem,
} from "@/lib/content-client";
import {
  announcements as demoAnnouncements,
  courses,
  events as demoEvents,
  faculty,
  group,
  students as demoStudents,
  teachers as demoTeachers,
  university,
} from "@/lib/demo-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Student TM" },
      {
        name: "description",
        content: "Manage students, teachers, announcements and events.",
      },
      { property: "og:title", content: "Admin panel — Student TM" },
      { property: "og:description", content: "Manage students, teachers, announcements and events." },
    ],
  }),
  component: AdminPage,
});

type TabId = "students" | "teachers";
type AdminPanel = "overview" | "content" | "control";
type ContentKind = "announcement" | "event";
type AssignableRole = "student" | "teacher" | "admin";
type ManagedAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  groupName: string | null;
};

function AdminPage() {
  return (
    <AppShell allow={["admin", "superadmin"]}>
      <AdminConsole />
    </AppShell>
  );
}

function AdminConsole() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("students");
  const [panel, setPanel] = useState<AdminPanel>("overview");

  const [data, setData] = useState<Record<TabId, ResourceItem[]>>(() => ({
    students: demoStudents.map((s) => ({
      id: s.id,
      label: s.name,
      sub: `${s.studentCode} · ${group.name}`,
    })),
    teachers: demoTeachers.map((x) => ({
      id: x.id,
      label: x.name,
      sub: `${x.title} · ${x.email}`,
    })),
  }));

  const stats: { id: TabId; value: number; icon: LucideIcon; label: string }[] = [
    {
      id: "students",
      value: data.students.length,
      icon: GraduationCap,
      label: t("admin.students"),
    },
    { id: "teachers", value: data.teachers.length, icon: Presentation, label: t("admin.teachers") },
  ];

  const monitoring = [
    {
      label: "Active students",
      value: data.students.length,
      detail: "Registered in the group",
      icon: Users,
      tone: "text-primary",
    },
    {
      label: "Published content",
      value: demoAnnouncements.length + demoEvents.length,
      detail: "Announcements and events",
      icon: CheckCircle2,
      tone: "text-success",
    },
  ];

  return (
    <div className="animate-rise space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-card sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Shield className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("admin.title")}
          </p>
          <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight">{university.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium sm:flex-col sm:items-end">
          <span className="rounded-full bg-primary-soft px-3 py-1 text-primary">
            {university.shortName}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {faculty.name}
          </span>
        </div>
      </section>

      <nav aria-label="Admin dashboard sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-card">
        {[
          ["overview", "Overview"],
          ["content", "Announcements & events"],
          ["control", "Control center"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id as AdminPanel)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
              panel === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {panel === "overview" ? <>
      <section
        aria-label={t("admin.overview")}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {stats.map((s) => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            aria-pressed={tab === s.id}
            className={cn(
              "card-surface flex flex-col items-start p-4 text-left transition-colors hover:border-primary/50",
              tab === s.id && "border-primary ring-1 ring-primary",
            )}
          >
            <s.icon className="h-5 w-5 text-primary" />
            <span className="mt-3 text-2xl font-bold leading-none">{s.value}</span>
            <span className="mt-1 w-full truncate text-xs text-muted-foreground">{s.label}</span>
          </button>
        ))}
      </section>

      <section aria-label="System monitoring" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {monitoring.map((item) => (
          <div key={item.label} className="card-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </span>
              <item.icon className={cn("h-4 w-4", item.tone)} />
            </div>
            <p className="mt-3 text-2xl font-bold">{item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <ResourceManager
            key={tab}
            title={t(`admin.${tab}`)}
            items={data[tab]}
            onChange={(next) => setData((d) => ({ ...d, [tab]: next }))}
          />
        </div>
      </div>
      </> : null}

      {panel === "content" ? (
        <ContentPublisher />
      ) : null}

      {panel === "control" ? <AdminOperations /> : null}
    </div>
  );
}

function ContentPublisher() {
  const [kind, setKind] = useState<ContentKind | "notification">("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [audience, setAudience] = useState<"all" | "students" | "teachers">("all");
  const [category, setCategory] = useState("university");
  const [important, setImportant] = useState(false);
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [contentView, setContentView] = useState<"messages" | "materials">("messages");

  useEffect(() => {
    let active = true;
    void getContent<{ items: PublishedItem[] }>("admin-content")
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load published content.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const response = await postContent<{ item: PublishedItem; recipientCount: number }>({
        action: "publish",
        type: kind,
        title,
        body,
        date,
        place,
        audience,
        category,
        important,
      });
      setItems((current) => [response.item, ...current.filter((item) => item.id !== response.item.id)]);
      setTitle("");
      setBody("");
      setDate("");
      setPlace("");
      setImportant(false);
      setSuccess(`Published. ${response.recipientCount} notification${response.recipientCount === 1 ? "" : "s"} sent.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to publish content.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeItem = async (item: PublishedItem) => {
    setError("");
    setSuccess("");
    setDeletingId(item.id);
    try {
      await deleteContent<{ deleted: boolean }>(`id=${encodeURIComponent(item.id)}`);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setSuccess("Published content deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete content.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([["messages", "Announcements, notifications & events"], ["materials", "Lesson materials"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setContentView(value)}
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm font-semibold",
              contentView === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {contentView === "materials" ? <LectureMaterialsPanel courses={courses} /> : (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              {kind === "announcement" ? <Bell className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="font-bold">Send an update</h2>
              <p className="text-xs text-muted-foreground">Published updates are saved and sent to the selected audience.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {([['announcement', 'Announcement'], ['notification', 'Notification'], ['event', 'Event']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setKind(value)} className={cn("rounded-xl px-3 py-2.5 text-sm font-semibold", kind === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{label}</button>
            ))}
          </div>
          <label className="mt-4 block text-sm font-medium">Title<input required minLength={2} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-normal" /></label>
          <label className="mt-3 block text-sm font-medium">{kind === "announcement" ? "Message" : kind === "event" ? "Description" : "Notification text"}<textarea required maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 font-normal" /></label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {kind === "event" ? <label className="text-sm font-medium">Date<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-normal" /></label> : null}
            {kind === "event" ? <label className="text-sm font-medium">Place<input required maxLength={200} value={place} onChange={(e) => setPlace(e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-normal" /></label> : null}
            {kind === "announcement" ? (
              <label className="text-sm font-medium">Category
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-normal">
                  <option value="university">University</option><option value="faculty">Faculty</option><option value="department">Department</option><option value="group">Group</option><option value="emergency">Emergency</option>
                </select>
              </label>
            ) : null}
            <label className="text-sm font-medium">Send to
              <select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "students" | "teachers")} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-normal">
                <option value="all">Students and teachers</option><option value="students">Students only</option><option value="teachers">Teachers only</option>
              </select>
            </label>
          </div>
          {kind === "announcement" ? <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />Mark as important</label> : null}
          <button type="submit" disabled={submitting} className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Megaphone className="h-4 w-4" />{submitting ? "Sending…" : kind === "notification" ? "Send notification" : "Publish"}</button>
          {error ? <p role="alert" className="mt-3 text-xs font-medium text-destructive">{error}</p> : null}
          {success ? <p role="status" className="mt-3 text-xs font-medium text-success">{success}</p> : null}
        </form>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-bold">Published content</h2>
          <div className="mt-4 space-y-2">
            {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p> : null}
            {!loading && items.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No content has been published yet.</p> : null}
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl bg-muted/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold">{item.title}</p><span className="text-[11px] capitalize text-primary">{item.type} · {item.audience}</span></div>
                  <button type="button" disabled={deletingId === item.id} aria-label={`Delete ${item.title}`} onClick={() => void removeItem(item)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="size-4" /></button>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                {item.type === "event" ? <p className="mt-1 text-[11px] text-muted-foreground">{item.date} · {item.place}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </div>
      )}
    </section>
  );
}

const adminSections = [
  { id: "users", label: "Users", icon: UserRoundCog },
  { id: "groups", label: "Groups & subjects", icon: Users },
  { id: "audit", label: "Audit & moderation", icon: History },
  { id: "bulk", label: "Bulk operations", icon: SlidersHorizontal },
  { id: "integrations", label: "Integrations", icon: Bell },
  { id: "settings", label: "System settings", icon: Settings2 },
] as const;

function AdminOperations() {
  const [section, setSection] = useState<(typeof adminSections)[number]["id"]>("users");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [fileLimit, setFileLimit] = useState("25");
  const [theme, setTheme] = useState("system");
  const [integrations, setIntegrations] = useState({ calendar: false, email: true, push: true });
  const [users, setUsers] = useState<ManagedAccount[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AssignableRole>("student");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      try {
        const response = await fetch("/api/profile?view=admin-users", {
          credentials: "include",
        });
        const payload = (await response.json()) as {
          users?: ManagedAccount[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load user profiles.");
        }
        if (active) setUsers(payload.users ?? []);
      } catch (error) {
        if (active) {
          setUsersError(error instanceof Error ? error.message : "Unable to load user profiles.");
        }
      } finally {
        if (active) setUsersLoading(false);
      }
    };

    void loadUsers();
    return () => {
      active = false;
    };
  }, []);

  const createProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, role }),
      });
      const payload = (await response.json()) as {
        user?: ManagedAccount;
        error?: string;
      };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "Unable to create the account.");
      }

      const createdUser = payload.user;
      setUsers((current) => [
        createdUser,
        ...current.filter((user) => user.id !== createdUser.id),
      ]);
      setName("");
      setEmail("");
      setPassword("");
      setRole("student");
      setCreateSuccess("Profile created. Share the login details with the user.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to create the account.");
    } finally {
      setCreating(false);
    }
  };

  const events = [
    "G. Nurygdyyev uploaded lecture-04.pdf",
    "Admin changed S. Ovezova role to Student",
    "M. Atayev submitted Lab report: loops",
    "Archive request for Group 1B was reviewed",
  ];
  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email} ${user.role} ${user.groupName ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Administration
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Control center</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage access, content, operations and system policy from one place.
            </p>
          </div>
          {section === "users" ? (
            <div className="relative sm:w-64">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users"
                aria-label="Search users"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pl-9 text-sm outline-none focus:border-ring"
              />
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
          ) : null}
        </div>
        <nav
          aria-label="Admin management sections"
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
        >
          {adminSections.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                section === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </nav>
      </div>

      {section === "users" ? (
        <div className="divide-y divide-border">
          <div className="p-4 sm:p-5">
            <form
              onSubmit={createProfile}
              className="rounded-2xl border border-border bg-background p-4 sm:p-5"
            >
              <div>
                <h3 className="font-bold">Add a profile</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a login and assign the account role. Passwords must be at least 8 characters.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-medium">
                  Full name
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="text-sm font-medium">
                  Email
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="text-sm font-medium">
                  Temporary password
                  <input
                    required
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="text-sm font-medium">
                  Role
                  <select
                    required
                    value={role}
                    onChange={(event) => setRole(event.target.value as AssignableRole)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2.5 font-normal"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Administrator</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Creating profile…" : "Create profile"}
                </button>
                <span aria-live="polite" className="text-xs">
                  {createError ? <span className="text-destructive">{createError}</span> : null}
                  {createSuccess ? <span className="text-success">{createSuccess}</span> : null}
                </span>
              </div>
            </form>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            {[
              { label: "Accounts", value: users.length },
              { label: "Teachers", value: users.filter((user) => user.role === "teacher").length },
              { label: "Administrators", value: users.filter((user) => user.role === "admin" || user.role === "superadmin").length },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-muted/60 p-3">
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersLoading ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Loading profiles…
                    </td>
                  </tr>
                ) : usersError ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-destructive">
                      {usersError}
                    </td>
                  </tr>
                ) : filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium">{user.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="px-5 py-3 capitalize text-muted-foreground">
                          {user.role === "superadmin" ? "Superadmin" : user.role}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{user.groupName || "—"}</td>
                      </tr>
                    ))}
                {!usersLoading && !usersError && filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      {users.length === 0 ? "No profiles found." : "No matching profiles."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 p-4 sm:p-5">
            <button
              onClick={() => setSaved(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Upload className="h-4 w-4" /> Import users
            </button>
            <button
              onClick={() => setSaved(true)}
              className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            {saved ? (
              <span className="self-center text-xs font-medium text-success">
                Action queued successfully.
              </span>
            ) : null}
          </div>
        </div>
      ) : section === "groups" ? (
        <ActionGrid
          items={[
            "Create group",
            "Archive group",
            "Move students",
            "Assign teacher",
            "Create subject",
            "Export roster",
          ]}
        />
      ) : section === "audit" ? (
        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
          <div className="space-y-2">
            {events.map((event, index) => (
              <div key={event} className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">{event}</p>
                  <p className="text-xs text-muted-foreground">
                    {index + 1} hour{index ? "s" : ""} ago · system audit
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
            <FileWarning className="h-5 w-5 text-warning" />
            <p className="mt-3 text-sm font-semibold">3 items need moderation</p>
            <button
              onClick={() => setSaved(true)}
              className="mt-3 rounded-lg bg-warning px-3 py-2 text-xs font-semibold text-warning-foreground"
            >
              Review queue
            </button>
          </div>
        </div>
      ) : section === "bulk" ? (
        <ActionGrid
          items={[
            "Notify selected groups",
            "Export grades XLSX",
            "Archive old groups",
            "Bulk file review",
            "Send deadline reminder",
            "Download activity log",
          ]}
        />
      ) : section === "integrations" ? (
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <IntegrationCard
            icon={CalendarDays}
            title="Calendar"
            description="Sync lessons, deadlines and campus events."
            enabled={integrations.calendar}
            actionLabel={integrations.calendar ? "Connected" : "Connect calendar"}
            onToggle={() => setIntegrations((current) => ({ ...current, calendar: !current.calendar }))}
          />
          <IntegrationCard
            icon={Mail}
            title="Email notifications"
            description="Send digest emails for new content and grades."
            enabled={integrations.email}
            actionLabel={integrations.email ? "Enabled" : "Enable email"}
            onToggle={() => setIntegrations((current) => ({ ...current, email: !current.email }))}
          />
          <IntegrationCard
            icon={Bell}
            title="Push notifications"
            description="Notify students instantly about important changes."
            enabled={integrations.push}
            actionLabel={integrations.push ? "Enabled" : "Enable push"}
            onToggle={() => setIntegrations((current) => ({ ...current, push: !current.push }))}
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <label className="text-sm font-medium">
            Theme
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Max file size (MB)
            <input
              value={fileLimit}
              onChange={(e) => setFileLimit(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() => setSaved(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Settings2 className="h-4 w-4" /> Save policy
            </button>
          </div>
          {saved ? (
            <p className="text-xs font-medium text-success sm:col-span-3">
              Settings saved. Changes will apply to new uploads.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  description,
  enabled,
  actionLabel,
  onToggle,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  actionLabel: string;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", enabled ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
          {enabled ? "Active" : "Off"}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{description}</p>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mt-4 w-full rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
          enabled ? "bg-muted text-foreground hover:bg-muted/70" : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function ActionGrid({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
      {items.map((item, index) => (
        <button
          key={item}
          onClick={() => window.alert(`${item} is ready to configure.`)}
          className="group flex items-center justify-between rounded-2xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card"
        >
          <span>
            <span className="block text-sm font-semibold">{item}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Open workflow and review changes
            </span>
          </span>
          {index % 2 ? (
            <Archive className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
          ) : (
            <Settings2 className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
          )}
        </button>
      ))}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader } from "@/components/app/ui-kit";
import { MaterialCard } from "@/components/app/cards";
import { LectureMaterialsPanel } from "@/components/teacher/panels";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { courses, materials, teacherIdForAccount } from "@/lib/demo-data";
import { getContent, type SavedMaterial } from "@/lib/content-client";

export const Route = createFileRoute("/materials")({
  head: () => ({
    meta: [
      { title: "Study materials — Student TM" },
      { name: "description", content: "Lecture PDFs, slides, documents and video links organised by course." },
      { property: "og:title", content: "Study materials — Student TM" },
      { property: "og:description", content: "Lecture PDFs, slides and links by course." },
    ],
  }),
  component: MaterialsPage,
});

function MaterialsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [publishedMaterials, setPublishedMaterials] = useState<SavedMaterial[]>([]);
  const [materialsError, setMaterialsError] = useState("");

  useEffect(() => {
    if (user?.role !== "student") return;
    let active = true;
    void getContent<{ items: SavedMaterial[] }>("materials")
      .then((response) => {
        if (active) setPublishedMaterials(response.items);
      })
      .catch((error) => {
        if (active) setMaterialsError(error instanceof Error ? error.message : "Unable to load lesson materials.");
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);

  if (user?.role === "teacher") {
    const teacherId = teacherIdForAccount(user.email, user.id);
    const teacherCourses = courses.filter((course) => course.teacherId === teacherId);
    return (
      <AppShell allow={["student", "teacher"]}>
        <PageHeader title={t("materials.title")} />
        <LectureMaterialsPanel courses={teacherCourses} />
      </AppShell>
    );
  }

  const grouped = courses
    .map((c) => ({
      course: c,
      items: materials.filter((m) => m.courseId === c.id),
      published: publishedMaterials.filter((m) => m.courseId === c.id),
    }))
    .filter((g) => g.items.length || g.published.length);

  return (
    <AppShell allow={["student"]}>
      <PageHeader title={t("materials.title")} />
        {materialsError ? <p role="alert" className="mb-4 text-sm text-destructive">{materialsError}</p> : null}
      {grouped.length === 0 ? (
        <EmptyState message={t("empty.materials")} />
      ) : (
        <div className="space-y-7">
          {grouped.map(({ course, items, published: courseMaterials }) => (
            <section key={course.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {course.name}
              </h2>
              <div className="space-y-3">
                {items.map((m) => (
                  <MaterialCard key={m.id} m={m} />
                ))}
                {courseMaterials.map((m) => (
                  <MaterialCard key={m.id} m={{ id: m.id, courseId: m.courseId, title: m.title, kind: m.kind, size: m.size, downloadUrl: m.downloadUrl }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

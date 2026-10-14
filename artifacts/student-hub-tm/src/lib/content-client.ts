import type { AnnCategory, Material, Notification } from "@/lib/demo-data";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  author: string;
  date: string;
  category: AnnCategory;
  important?: boolean;
};

export type EventItem = {
  id: string;
  title: string;
  date: string;
  place: string;
  body: string;
};

export type PublishedItem = {
  id: string;
  type: "announcement" | "event" | "notification";
  title: string;
  body: string;
  date: string;
  place: string;
  audience: string;
};

export type SavedMaterial = {
  id: string;
  courseId: string;
  courseName: string;
  groupId: string;
  groupName: string;
  title: string;
  description: string;
  fileName: string;
  kind: Material["kind"];
  size: string;
  sizeBytes: number;
  uploadedAt: string;
  downloadUrl: string;
};

export type SavedNotification = {
  id: string;
  kind: Notification["kind"];
  text: string;
  href: string | null;
  read: boolean;
  createdAt: string;
  time: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
  return payload;
}

export function getContent<T>(type: string) {
  return requestJson<T>(`/api/content?type=${encodeURIComponent(type)}`);
}

export function postContent<T>(body: Record<string, unknown>) {
  return requestJson<T>("/api/content", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchContent<T>(body: Record<string, unknown>) {
  return requestJson<T>("/api/content", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteContent<T>(query: string) {
  return requestJson<T>(`/api/content?${query}`, { method: "DELETE" });
}

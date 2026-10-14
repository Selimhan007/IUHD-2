import { sql } from "drizzle-orm";
import { auth } from "@/lib/server-auth";
import { db } from "@/lib/profile-db";
import { ObjectStorageService, ObjectNotFoundError } from "@/lib/storage/objectStorage";
import { courses, events as demoEvents, teacherIdForAccount } from "@/lib/demo-data";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: string;
  groupName: string | null;
};

type ContentKind = "announcement" | "event" | "notification";
type Audience = "all" | "students" | "teachers";
type Row = Record<string, unknown>;

const storage = new ObjectStorageService();
const groups = [
  { id: "g1", name: "1B" },
  { id: "g2", name: "1C" },
  { id: "g3", name: "2A" },
];
const fileTypes: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
  ppt: ["application/vnd.ms-powerpoint", "application/octet-stream"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"],
  mp4: ["video/mp4", "application/octet-stream"],
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  return json({ error: "The request could not be completed." }, 500);
}

async function getActor(request: Request): Promise<Actor> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new Response("Unauthorized", { status: 401 });

  const result = await db.execute(sql`
    SELECT role, "groupName" FROM profiles WHERE "userId" = ${session.user.id} LIMIT 1
  `);
  const profile = result.rows[0] as Row | undefined;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: typeof profile?.["role"] === "string" ? profile["role"] : "student",
    groupName: typeof profile?.["groupName"] === "string" ? profile["groupName"] : null,
  };
}

function requireRole(actor: Actor, roles: string[]) {
  if (!roles.includes(actor.role)) throw new Response("Forbidden", { status: 403 });
}

async function readBody(request: Request): Promise<Row> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new Response("Invalid JSON body.", { status: 400 });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Response("Invalid request body.", { status: 400 });
  }
  return value as Row;
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function audienceFor(actor: Actor) {
  if (actor.role === "admin" || actor.role === "superadmin") return null;
  return actor.role === "teacher" ? "teachers" : "students";
}

function canSeeAudience(actor: Actor) {
  const audience = audienceFor(actor);
  return sql`(${audience === null} OR audience = 'all' OR audience = ${audience})`;
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function isoDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function contentItem(row: Row) {
  return {
    id: String(row["id"]),
    type: String(row["content_type"]),
    title: String(row["title"]),
    body: String(row["body"]),
    date: dateOnly(row["event_date"]) || dateOnly(row["created_at"]),
    place: typeof row["place"] === "string" ? row["place"] : "",
    author: typeof row["author_name"] === "string" ? row["author_name"] : "",
    category: typeof row["category"] === "string" ? row["category"] : "university",
    important: Boolean(row["important"]),
    audience: String(row["audience"] ?? "all"),
    createdAt: isoDate(row["created_at"]),
  };
}

function materialItem(row: Row) {
  const size = Number(row["size_bytes"] ?? 0);
  const kind = String(row["file_name"]).split(".").pop()?.toLowerCase() ?? "pdf";
  return {
    id: String(row["id"]),
    courseId: String(row["course_id"]),
    courseName: String(row["course_name"]),
    groupId: String(row["group_id"]),
    groupName: String(row["group_name"]),
    title: String(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : "",
    fileName: String(row["file_name"]),
    kind: kind === "doc" ? "docx" : kind === "ppt" ? "pptx" : kind === "mp4" ? "video" : kind,
    size: size > 0 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : "—",
    sizeBytes: size,
    uploadedAt: isoDate(row["created_at"]),
    downloadUrl: `/api/content?downloadId=${encodeURIComponent(String(row["id"]))}`,
  };
}

async function getContent(request: Request) {
  const actor = await getActor(request);
  const url = new URL(request.url);
  const downloadId = url.searchParams.get("downloadId");
  if (downloadId) return downloadMaterial(actor, downloadId);

  const type = url.searchParams.get("type") ?? "";
  if (type === "announcements" || type === "events") {
    const contentType = type === "events" ? "event" : "announcement";
    const result = await db.execute(sql`
      SELECT id, content_type, title, body, category, important, event_date, place, audience,
        author_name, created_at
      FROM student_content_posts
      WHERE content_type = ${contentType} AND ${canSeeAudience(actor)}
      ORDER BY created_at DESC
    `);
    const items = (result.rows as Row[]).map(contentItem);
    if (type === "events") {
      const registrations = await db.execute(sql`
        SELECT event_id FROM student_event_registrations WHERE user_id = ${actor.id}
      `);
      return json({
        items,
        registeredEventIds: registrations.rows.map((row) => String((row as Row)["event_id"])),
      });
    }
    return json({ items });
  }

  if (type === "admin-content") {
    requireRole(actor, ["admin", "superadmin"]);
    const result = await db.execute(sql`
      SELECT id, content_type, title, body, category, important, event_date, place, audience,
        author_name, created_at
      FROM student_content_posts ORDER BY created_at DESC LIMIT 50
    `);
    return json({ items: (result.rows as Row[]).map(contentItem) });
  }

  if (type === "notifications") {
    const result = await db.execute(sql`
      SELECT id, kind, text, href, is_read, created_at
      FROM student_user_notifications
      WHERE recipient_user_id = ${actor.id}
      ORDER BY created_at DESC LIMIT 100
    `);
    return json({
      items: (result.rows as Row[]).map((row) => ({
        id: String(row["id"]),
        kind: String(row["kind"]),
        text: String(row["text"]),
        href: typeof row["href"] === "string" ? row["href"] : null,
        read: Boolean(row["is_read"]),
        createdAt: isoDate(row["created_at"]),
        time: new Date(String(row["created_at"])).toLocaleString(),
      })),
    });
  }

  if (type === "materials" || type === "teacher-materials") {
    if (type === "materials") requireRole(actor, ["student"]);
    else requireRole(actor, ["teacher", "admin", "superadmin"]);
    const groupName = actor.groupName ?? "1B";
    const result = type === "materials"
      ? await db.execute(sql`
          SELECT m.id, m.course_id, m.course_name, m.group_id, m.group_name, m.title,
            m.description, m.file_name, m.content_type, m.size_bytes, m.created_at
          FROM student_lesson_materials AS m
          WHERE m.group_name = ${groupName}
          ORDER BY m.created_at DESC
        `)
      : actor.role === "admin" || actor.role === "superadmin"
        ? await db.execute(sql`
            SELECT m.id, m.course_id, m.course_name, m.group_id, m.group_name, m.title,
              m.description, m.file_name, m.content_type, m.size_bytes, m.created_at
            FROM student_lesson_materials AS m ORDER BY m.created_at DESC
          `)
        : await db.execute(sql`
            SELECT m.id, m.course_id, m.course_name, m.group_id, m.group_name, m.title,
              m.description, m.file_name, m.content_type, m.size_bytes, m.created_at
            FROM student_lesson_materials AS m
            WHERE m.uploader_id = ${actor.id}
            ORDER BY m.created_at DESC
          `);
    return json({ items: (result.rows as Row[]).map(materialItem) });
  }

  return json({ error: "Unknown content type." }, 400);
}

async function downloadMaterial(actor: Actor, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid material." }, 400);
  const result = await db.execute(sql`
    SELECT id, object_path, file_name, content_type, group_name, uploader_id
    FROM student_lesson_materials WHERE id = ${id} LIMIT 1
  `);
  const row = result.rows[0] as Row | undefined;
  if (!row) return json({ error: "Material not found." }, 404);
  const allowed = actor.role === "admin" || actor.role === "superadmin"
    || (actor.role === "teacher" && row["uploader_id"] === actor.id)
    || (actor.role === "student" && row["group_name"] === (actor.groupName ?? "1B"));
  if (!allowed) return json({ error: "You cannot access this material." }, 403);

  try {
    const file = await storage.getObjectEntityFile(String(row["object_path"]));
    const storedResponse = await storage.downloadObject(file, 0);
    const headers = new Headers(storedResponse.headers);
    headers.set("Content-Type", String(row["content_type"] || "application/octet-stream"));
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(String(row["file_name"]))}`);
    headers.set("Cache-Control", "private, no-store");
    return new Response(storedResponse.body, { status: storedResponse.status, headers });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return json({ error: "Stored file not found." }, 404);
    throw error;
  }
}

function validAudience(value: unknown): value is Audience {
  return value === "all" || value === "students" || value === "teachers";
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

async function publishContent(actor: Actor, body: Row) {
  requireRole(actor, ["admin", "superadmin"]);
  const type = body["type"];
  if (type !== "announcement" && type !== "event" && type !== "notification") {
    return json({ error: "Choose an announcement, notification, or event." }, 400);
  }
  const title = text(body["title"], 160);
  const message = text(body["body"], 5000);
  const audience = body["audience"] ?? "all";
  if (title.length < 2 || !message) return json({ error: "Enter a title and message." }, 400);
  if (!validAudience(audience)) return json({ error: "Choose a valid audience." }, 400);

  const category = body["category"];
  const categories = ["university", "faculty", "department", "group", "emergency", "event"];
  if (type === "announcement" && !categories.includes(String(category))) {
    return json({ error: "Choose a valid announcement category." }, 400);
  }

  const eventDate = type === "event" ? text(body["date"], 10) : "";
  const place = type === "event" ? text(body["place"], 200) : "";
  if (type === "event" && (!validDate(eventDate) || !place)) {
    return json({ error: "Enter a valid event date and location." }, 400);
  }

  const id = crypto.randomUUID();
  const notificationKind = type === "event" ? "event" : "announcement";
  const notificationHref = type === "event" ? "/events" : "/announcements";
  const notificationText = `${title}: ${message}`.slice(0, 600);

  const publication = await db.transaction(async (tx) => {
    const inserted = await tx.execute(sql`
      INSERT INTO student_content_posts
        (id, content_type, title, body, category, important, event_date, place, audience, author_id, author_name)
      VALUES
        (${id}, ${type}, ${title}, ${message}, ${type === "announcement" ? String(category) : type},
         ${Boolean(body["important"])}, ${eventDate || null}, ${place || null}, ${audience}, ${actor.id}, ${actor.name})
      RETURNING id, content_type, title, body, category, important, event_date, place, audience,
        author_name, created_at
    `);
    const recipients = await tx.execute(sql`
      INSERT INTO student_user_notifications
        (id, recipient_user_id, kind, text, href, source_id)
      SELECT gen_random_uuid(), u.id, ${notificationKind}, ${notificationText}, ${notificationHref}, ${id}
      FROM "user" AS u
      LEFT JOIN profiles AS p ON p."userId" = u.id
      WHERE ${audience} = 'all'
        OR (${audience} = 'students' AND COALESCE(p.role, 'student') = 'student')
        OR (${audience} = 'teachers' AND p.role = 'teacher')
    `);
    return {
      item: contentItem(inserted.rows[0] as Row),
      recipientCount: Number(recipients.rowCount ?? 0),
    };
  });
  return json(publication, 201);
}

function validateCourse(actor: Actor, courseId: string) {
  const course = courses.find((item) => item.id === courseId);
  if (!course) return null;
  if (actor.role === "teacher" && course.teacherId !== teacherIdForAccount(actor.email, actor.id)) return null;
  return course;
}

async function requestUpload(actor: Actor, body: Row) {
  requireRole(actor, ["teacher", "admin", "superadmin"]);
  const fileName = text(body["name"], 200);
  const contentType = text(body["contentType"], 120) || "application/octet-stream";
  const size = Number(body["size"]);
  const courseId = text(body["courseId"], 30);
  const course = validateCourse(actor, courseId);
  if (!course) return json({ error: "You cannot upload material for this course." }, 403);
  if (!fileName || !Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024) {
    return json({ error: "Choose a file smaller than 10 MB." }, 400);
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!fileTypes[extension] || (contentType !== "application/octet-stream" && !fileTypes[extension]?.includes(contentType))) {
    return json({ error: "Use PDF, DOC, DOCX, PPT, PPTX, or MP4 files." }, 400);
  }

  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  const uploadId = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO student_lesson_material_uploads
      (id, owner_id, object_path, file_name, content_type, size_bytes, expires_at)
    VALUES (${uploadId}, ${actor.id}, ${objectPath}, ${fileName}, ${contentType}, ${size}, now() + interval '30 minutes')
  `);
  return json({ uploadId, uploadURL, objectPath });
}

async function createMaterial(actor: Actor, body: Row) {
  requireRole(actor, ["teacher", "admin", "superadmin"]);
  const title = text(body["title"], 160);
  const description = text(body["description"], 1000);
  const courseId = text(body["courseId"], 30);
  const groupId = text(body["groupId"], 12);
  const uploadId = text(body["uploadId"], 36);
  const course = validateCourse(actor, courseId);
  const groupInfo = groups.find((item) => item.id === groupId);
  if (!course) return json({ error: "You cannot publish material for this course." }, 403);
  if (title.length < 2 || !groupInfo || !/^[0-9a-f-]{36}$/i.test(uploadId)) {
    return json({ error: "Enter a title and choose a valid group and upload." }, 400);
  }

  const uploadResult = await db.execute(sql`
    SELECT id, object_path, file_name, content_type, size_bytes
    FROM student_lesson_material_uploads
    WHERE id = ${uploadId} AND owner_id = ${actor.id} AND expires_at > now()
    LIMIT 1
  `);
  const upload = uploadResult.rows[0] as Row | undefined;
  if (!upload) return json({ error: "The upload expired. Please upload the file again." }, 400);

  const file = await storage.getObjectEntityFile(String(upload["object_path"]));
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size ?? 0) !== Number(upload["size_bytes"])) {
    return json({ error: "The uploaded file could not be verified." }, 400);
  }

  const id = crypto.randomUUID();
  const item = await db.transaction(async (tx) => {
    const inserted = await tx.execute(sql`
      INSERT INTO student_lesson_materials
        (id, course_id, course_name, group_id, group_name, title, description,
         file_name, content_type, size_bytes, object_path, uploader_id)
      VALUES
        (${id}, ${course.id}, ${course.name}, ${groupId}, ${groupInfo.name}, ${title},
         ${description || null}, ${String(upload["file_name"])}, ${String(upload["content_type"])},
         ${Number(upload["size_bytes"])}, ${String(upload["object_path"])}, ${actor.id})
      RETURNING id, course_id, course_name, group_id, group_name, title, description,
        file_name, content_type, size_bytes, created_at
    `);
    await tx.execute(sql`
      INSERT INTO student_user_notifications
        (id, recipient_user_id, kind, text, href, source_id)
      SELECT gen_random_uuid(), u.id, 'material',
        ${`New lesson material: ${title} (${course.name})`}, '/materials', ${id}
      FROM "user" AS u
      LEFT JOIN profiles AS p ON p."userId" = u.id
      WHERE COALESCE(p.role, 'student') = 'student'
        AND COALESCE(p."groupName", '1B') = ${groupInfo.name}
    `);
    await tx.execute(sql`DELETE FROM student_lesson_material_uploads WHERE id = ${uploadId}`);
    return materialItem(inserted.rows[0] as Row);
  });
  return json({ item }, 201);
}

async function postContent(request: Request) {
  const actor = await getActor(request);
  const body = await readBody(request);
  const action = body["action"];
  if (action === "publish") return publishContent(actor, body);
  if (action === "request-upload") return requestUpload(actor, body);
  if (action === "create-material") return createMaterial(actor, body);
  if (action === "register-event") {
    const eventId = text(body["eventId"], 64);
    if (!eventId) return json({ error: "Choose an event." }, 400);
    const exists = await db.execute(sql`
      SELECT 1 FROM student_content_posts
      WHERE id::text = ${eventId} AND content_type = 'event' AND ${canSeeAudience(actor)}
      UNION ALL
      SELECT 1 WHERE ${demoEvents.some((event) => event.id === eventId)}
      LIMIT 1
    `);
    if (!exists.rows.length) return json({ error: "Event not found." }, 404);
    await db.execute(sql`
      INSERT INTO student_event_registrations (event_id, user_id)
      VALUES (${eventId}, ${actor.id}) ON CONFLICT (event_id, user_id) DO NOTHING
    `);
    return json({ registered: true });
  }
  return json({ error: "Unknown action." }, 400);
}

async function patchContent(request: Request) {
  const actor = await getActor(request);
  const body = await readBody(request);
  const notificationId = text(body["notificationId"], 36);
  if (body["markAll"] === true) {
    const result = await db.execute(sql`
      UPDATE student_user_notifications SET is_read = true
      WHERE recipient_user_id = ${actor.id} AND is_read = false
    `);
    return json({ updated: result.rowCount ?? 0 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) return json({ error: "Invalid notification." }, 400);
  const result = await db.execute(sql`
    UPDATE student_user_notifications SET is_read = true
    WHERE id = ${notificationId} AND recipient_user_id = ${actor.id}
  `);
  return json({ updated: result.rowCount ?? 0 });
}

async function deleteContent(request: Request) {
  const actor = await getActor(request);
  const url = new URL(request.url);
  const contentId = url.searchParams.get("id") ?? "";
  const materialId = url.searchParams.get("materialId") ?? "";

  if (contentId) {
    requireRole(actor, ["admin", "superadmin"]);
    if (!/^[0-9a-f-]{36}$/i.test(contentId)) return json({ error: "Invalid content." }, 400);
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM student_user_notifications WHERE source_id = ${contentId}`);
      await tx.execute(sql`DELETE FROM student_event_registrations WHERE event_id = ${contentId}`);
      await tx.execute(sql`DELETE FROM student_content_posts WHERE id = ${contentId}`);
    });
    return json({ deleted: true });
  }

  if (materialId) {
    if (!/^[0-9a-f-]{36}$/i.test(materialId)) return json({ error: "Invalid material." }, 400);
    const result = await db.execute(sql`
      SELECT id, object_path, uploader_id FROM student_lesson_materials WHERE id = ${materialId} LIMIT 1
    `);
    const row = result.rows[0] as Row | undefined;
    if (!row) return json({ error: "Material not found." }, 404);
    const canDelete = actor.role === "admin" || actor.role === "superadmin"
      || (actor.role === "teacher" && row["uploader_id"] === actor.id);
    if (!canDelete) return json({ error: "You cannot delete this material." }, 403);
    const file = await storage.getObjectEntityFile(String(row["object_path"]));
    await file.delete({ ignoreNotFound: true });
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM student_user_notifications WHERE source_id = ${materialId}`);
      await tx.execute(sql`DELETE FROM student_lesson_materials WHERE id = ${materialId}`);
    });
    return json({ deleted: true });
  }

  return json({ error: "Choose content to delete." }, 400);
}

export const contentHandlers = {
  GET: async (request: Request) => {
    try {
      return await getContent(request);
    } catch (error) {
      return errorResponse(error);
    }
  },
  POST: async (request: Request) => {
    try {
      return await postContent(request);
    } catch (error) {
      return errorResponse(error);
    }
  },
  PATCH: async (request: Request) => {
    try {
      return await patchContent(request);
    } catch (error) {
      return errorResponse(error);
    }
  },
  DELETE: async (request: Request) => {
    try {
      return await deleteContent(request);
    } catch (error) {
      return errorResponse(error);
    }
  },
};

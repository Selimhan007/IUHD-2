import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { db } from "@/lib/profile-db";
import { auth } from "@/lib/server-auth";

async function getUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new Response("Unauthorized", { status: 401 });
  return session.user.id;
}

async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new Response("Unauthorized", { status: 401 });

  const result = await db.execute(sql`
    SELECT role FROM profiles WHERE "userId" = ${session.user.id} LIMIT 1
  `);
  const role = result.rows[0]?.["role"];
  if (role !== "admin" && role !== "superadmin") {
    throw new Response("Forbidden", { status: 403 });
  }

  return session.user;
}

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          if (new URL(request.url).searchParams.get("view") === "admin-users") {
            await requireAdmin(request);
            const result = await db.execute(sql`
              SELECT u.id, u.name, u.email, COALESCE(p.role, 'student') AS role,
                p."groupName" AS "groupName"
              FROM "user" AS u
              LEFT JOIN profiles AS p ON p."userId" = u.id
              ORDER BY u."createdAt" DESC, u.email ASC
            `);
            return Response.json({ users: result.rows });
          }

          const userId = await getUserId(request);
          const result = await db.execute(sql`
            SELECT "userId", role, "studentCode", phone, university, faculty, department,
              program, "groupName", year, "avatarUrl", bio
            FROM profiles WHERE "userId" = ${userId} LIMIT 1
          `);
          return Response.json(result.rows[0] ?? null);
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: "Unable to load profile" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          await requireAdmin(request);

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json({ error: "Invalid request body." }, { status: 400 });
          }

          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return Response.json({ error: "Invalid request body." }, { status: 400 });
          }

          const input = body as Record<string, unknown>;
          const name = typeof input["name"] === "string" ? input["name"].trim() : "";
          const email = typeof input["email"] === "string" ? input["email"].trim().toLowerCase() : "";
          const password = typeof input["password"] === "string" ? input["password"] : "";
          const role = input["role"];
          const validRoles = ["student", "teacher", "admin"] as const;

          if (name.length < 2 || name.length > 100) {
            return Response.json({ error: "Enter a name between 2 and 100 characters." }, { status: 400 });
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return Response.json({ error: "Enter a valid email address." }, { status: 400 });
          }
          if (password.length < 8 || password.length > 128) {
            return Response.json({ error: "Password must be between 8 and 128 characters." }, { status: 400 });
          }
          if (!validRoles.some((validRole) => validRole === role)) {
            return Response.json({ error: "Choose student, teacher, or admin." }, { status: 400 });
          }

          const existingUser = await db.execute(sql`
            SELECT 1 FROM "user" WHERE lower(email) = ${email} LIMIT 1
          `);
          if (existingUser.rows.length > 0) {
            return Response.json({ error: "An account with this email already exists." }, { status: 409 });
          }

          const created = await auth.api.signUpEmail({
            body: { name, email, password },
            headers: request.headers,
          });
          const createdRole = role as (typeof validRoles)[number];

          await db.execute(sql`
            INSERT INTO profiles (id, "userId", role)
            VALUES (${crypto.randomUUID()}, ${created.user.id}, ${createdRole})
          `);

          return Response.json(
            {
              user: {
                id: created.user.id,
                name: created.user.name,
                email: created.user.email,
                role: createdRole,
                groupName: null,
              },
            },
            { status: 201 },
          );
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: "Unable to create the account." }, { status: 500 });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const userId = await getUserId(request);
          const body = (await request.json()) as Record<string, unknown>;
          const allowed = ["phone", "university", "faculty", "department", "program", "groupName", "year", "avatarUrl", "bio"] as const;
          const values = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
          const result = await db.execute(sql`
            INSERT INTO profiles (id, "userId", phone, university, faculty, department, program, "groupName", year, "avatarUrl", bio)
            VALUES (${crypto.randomUUID()}, ${userId}, ${values["phone"] ?? null}, ${values["university"] ?? null}, ${values["faculty"] ?? null}, ${values["department"] ?? null}, ${values["program"] ?? null}, ${values["groupName"] ?? null}, ${values["year"] ?? null}, ${values["avatarUrl"] ?? null}, ${values["bio"] ?? null})
            ON CONFLICT ("userId") DO UPDATE SET
              phone = COALESCE(EXCLUDED.phone, profiles.phone), university = COALESCE(EXCLUDED.university, profiles.university),
              faculty = COALESCE(EXCLUDED.faculty, profiles.faculty), department = COALESCE(EXCLUDED.department, profiles.department),
              program = COALESCE(EXCLUDED.program, profiles.program), "groupName" = COALESCE(EXCLUDED."groupName", profiles."groupName"),
              year = COALESCE(EXCLUDED.year, profiles.year), "avatarUrl" = COALESCE(EXCLUDED."avatarUrl", profiles."avatarUrl"),
              bio = COALESCE(EXCLUDED.bio, profiles.bio), "updatedAt" = now()
            RETURNING "userId", role, "studentCode", phone, university, faculty, department, program, "groupName", year, "avatarUrl", bio
          `);
          return Response.json(result.rows[0]);
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: "Unable to save profile" }, { status: 500 });
        }
      },
    },
  },
});

export default Route;

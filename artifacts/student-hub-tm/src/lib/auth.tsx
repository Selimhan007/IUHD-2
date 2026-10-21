import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "./demo-data";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentCode?: string;
  phone?: string;
  staffCode?: string;
  office?: string;
  officeHours?: string;
  accessLevel?: string;
}

interface AuthCtx {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<{ ok: boolean }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean }>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<SessionUser>) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
  updateUser: () => {},
});

async function getSession(): Promise<SessionUser | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("/api/auth/get-session", {
      credentials: "include",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { user?: { id: string; name: string; email: string } } | null;
    if (!payload?.user) return null;

    let profile: Partial<SessionUser> | null = null;
    try {
      const profileResponse = await fetch("/api/profile", {
        credentials: "include",
        signal: controller.signal,
      });
      if (profileResponse.ok) {
        profile = (await profileResponse.json()) as Partial<SessionUser> | null;
      }
    } catch {
      // A missing profile must not keep the whole application in its loading state.
    }

    return {
      ...payload.user,
      ...profile,
      role: (profile?.role as Role | undefined) ?? "student",
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSession().then(setUser).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password, rememberMe: remember }),
      });
      if (!response.ok) return { ok: false };

      const sessionUser = await getSession();
      if (!sessionUser) return { ok: false };

      setUser(sessionUser);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      if (!response.ok) return { ok: false };

      const sessionUser = await getSession();
      if (!sessionUser) return { ok: false };

      setUser(sessionUser);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<SessionUser>) => setUser((current) => (current ? { ...current, ...patch } : current)), []);

  return <Ctx.Provider value={{ user, ready, login, register, logout, updateUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

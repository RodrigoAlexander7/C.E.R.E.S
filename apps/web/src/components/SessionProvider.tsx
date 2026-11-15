"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface SessionUser {
  id: string;
  email: string;
}

interface SessionState {
  user: SessionUser | null;
  activeParcelId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export const DRAFT_KEY = "ceres:borrador";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeParcelId, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: SessionUser; active_parcel_id: string | null }>("/me");
      setUser(me.user);
      setActive(me.active_parcel_id);
    } catch {
      setUser(null);
      setActive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      // Limpiar estado privado del cliente tras cerrar sesión.
      try {
        sessionStorage.clear();
      } catch {}
      setUser(null);
      setActive(null);
      window.location.assign("/");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ user, activeParcelId, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("SessionProvider ausente");
  return v;
}

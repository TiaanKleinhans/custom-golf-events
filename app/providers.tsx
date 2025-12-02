"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AdminContextValue = {
  isAdmin: boolean;
  loginWithPin: (pin: string) => boolean;
  logout: () => void;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

const ADMIN_STORAGE_KEY = "golf_event_is_admin";

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    setIsAdmin(stored === "true");
  }, []);

  const loginWithPin = useCallback((pin: string) => {
    const expectedPin = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "";
    const ok = pin === expectedPin && pin.length > 0;
    if (ok && typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_STORAGE_KEY, "true");
    }
    setIsAdmin(ok);
    return ok;
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
    setIsAdmin(false);
  }, []);

  const value = useMemo(
    () => ({
      isAdmin,
      loginWithPin,
      logout,
    }),
    [isAdmin, loginWithPin, logout],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin must be used inside <AdminProvider />");
  }
  return ctx;
}



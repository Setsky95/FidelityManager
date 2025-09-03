import { createContext, useContext, useEffect, useState } from "react";
import { auth, onAuthStateChanged, type User } from "@/lib/firebase";

type AdminCtx = { user: User | null; loading: boolean };
const Ctx = createContext<AdminCtx>({ user: null, loading: true });

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export const useAdminAuth = () => useContext(Ctx);

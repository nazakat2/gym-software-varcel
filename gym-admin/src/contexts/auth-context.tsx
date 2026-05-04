import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
  lastLogin?: string | null;
};

type AuthContextType = {
  user: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("gym_admin_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    let body: Record<string, unknown>;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) {
      throw new Error((body.message as string) || "Invalid email or password");
    }
    const loggedIn = (body as { user: AdminUser }).user;
    setUser(loggedIn);
    localStorage.setItem("gym_admin_user", JSON.stringify(loggedIn));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("gym_admin_user");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  gymId?: string | null;
  permissions: string[];
};

type Gym = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
} | null;

type AuthContextType = {
  user: AdminUser | null;
  gym: Gym;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Module-level query cache clearer — set by App.tsx
let _clearQueryCache: (() => void) | null = null;
export function registerQueryCacheClearer(fn: () => void) {
  _clearQueryCache = fn;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [gym, setGym] = useState<Gym>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem("gym_access_token");
      const storedUser = localStorage.getItem("gym_admin_user");

      if (accessToken && storedUser) {
        try {
          // Decode JWT to check gymId and expiry
          const payload = JSON.parse(atob(accessToken.split(".")[1]));

          // Check if token is expired
          const nowSec = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < nowSec) {
            // Token expired — clear storage and force re-login
            localStorage.removeItem("gym_access_token");
            localStorage.removeItem("gym_refresh_token");
            localStorage.removeItem("gym_admin_user");
            localStorage.removeItem("gym_admin_gym");
            setIsLoading(false);
            return;
          }

          if (!payload.gymId) {
            // Old token without gymId — force re-login
            localStorage.clear();
            setIsLoading(false);
            return;
          }
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          const storedGym = localStorage.getItem("gym_admin_gym");
          if (storedGym) setGym(JSON.parse(storedGym));
        } catch {
          localStorage.removeItem("gym_access_token");
          localStorage.removeItem("gym_refresh_token");
          localStorage.removeItem("gym_admin_user");
          localStorage.removeItem("gym_admin_gym");
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    let body: any;
    try { body = await res.json(); } catch { body = {}; }

    if (!res.ok) {
      throw new Error(body.message || "Invalid email or password");
    }

    const { user: loggedInUser, token } = body;
    if (!token) throw new Error("No token received from server");

    localStorage.setItem("gym_access_token", token);
    localStorage.setItem("gym_admin_user", JSON.stringify(loggedInUser));

    setUser(loggedInUser);
    setGym(null);

    // Clear React Query cache so dashboard re-fetches with new gymId token
    _clearQueryCache?.();
  };

  const logout = async () => {
    _clearQueryCache?.();
    setUser(null);
    setGym(null);
    localStorage.removeItem("gym_access_token");
    localStorage.removeItem("gym_refresh_token");
    localStorage.removeItem("gym_admin_user");
    localStorage.removeItem("gym_admin_gym");
  };

  return (
    <AuthContext.Provider value={{ user, gym, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

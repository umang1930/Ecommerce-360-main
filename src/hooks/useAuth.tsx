import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

interface User {
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (intent?: "set-password", returnTo?: string) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<{ user: User | null }> : { user: null })
      .then(({ user: sessionUser }) => {
        if (!active) return;
        setUser(sessionUser);
        setIsAuthenticated(Boolean(sessionUser));
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const login = (intent?: "set-password", returnTo?: string) => {
    const params = new URLSearchParams();
    if (intent === "set-password") params.set("intent", "set-password");
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) params.set("next", returnTo);
    const query = params.toString();
    window.location.assign(`/api/auth/google${query ? `?${query}` : ""}`);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      toast.error("Could not end the server session. Please try again.");
      return;
    }
    setIsAuthenticated(false);
    setUser(null);
    toast.info("Logged out successfully");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

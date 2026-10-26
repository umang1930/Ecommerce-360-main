import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { verifyDashboardLogin } from "@/lib/dashboard/auth";

interface User {
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function nameFromEmail(email: string) {
  return email.trim().split("@")[0] || "User";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check localStorage for existing session
    const storedAuth = localStorage.getItem("auth_session");
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth) as User;
        const emailName = nameFromEmail(parsed.email);
        if (parsed.name !== emailName) {
          parsed.name = emailName;
          localStorage.setItem("auth_session", JSON.stringify(parsed));
        }
        setIsAuthenticated(true);
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem("auth_session");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const valid = await verifyDashboardLogin({ data: { email, password } });
    if (valid) {
      const normalizedEmail = email.trim().toLowerCase();
      const adminUser: User = {
        email: normalizedEmail,
        name: nameFromEmail(normalizedEmail),
        role: "Founder & Admin",
      };
      
      setIsAuthenticated(true);
      setUser(adminUser);
      localStorage.setItem("auth_session", JSON.stringify(adminUser));
      return true;
    }
    
    toast.error("Invalid credentials", {
      description: "Please check your email and password and try again.",
    });
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("auth_session");
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

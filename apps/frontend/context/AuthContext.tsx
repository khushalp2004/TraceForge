"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const tokenKey = "traceforge_token";
const userKey = "traceforge_user";

type AuthUser = {
  id: string;
  fullName?: string | null;
  address?: string | null;
  email: string;
  plan?: "FREE" | "PRO" | "TEAM";
  planExpiresAt?: string | null;
};

const readStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(userKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(userKey);
    return null;
  }
};

interface AuthContextType {
  token: string | null;
  isLoggedIn: boolean;
  isReady: boolean;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenKey);
    const storedUser = readStoredUser();

    if (storedToken) {
      setToken(storedToken);
      setUser(storedUser);
      setIsReady(true);
      void fetchUser(storedToken);
      return;
    }

    if (storedUser) {
      localStorage.removeItem(userKey);
    }

    setIsReady(true);
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem(userKey, JSON.stringify(data.user));
        return;
      }

      if (res.status === 401) {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        setToken(null);
        setUser(null);
      }
    } catch {}
  };

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem(tokenKey, newToken);
    localStorage.setItem(userKey, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setIsReady(true);
  };

  const logout = () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    isLoggedIn: !!token,
    isReady,
    user,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

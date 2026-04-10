"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
const userKey = "traceforge_user";
const sessionTokenValue = "cookie-session";

type AuthUser = {
  id: string;
  fullName?: string | null;
  address?: string | null;
  email: string;
  plan?: "FREE" | "DEV" | "PRO" | "TEAM";
  planExpiresAt?: string | null;
  isSuperAdmin?: boolean;
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
    const rawApiUrl = API_URL;
    const originalFetch = window.fetch.bind(window);
    const apiOrigin = new URL(rawApiUrl, window.location.origin).origin;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const shouldIncludeCredentials = requestUrl.startsWith(apiOrigin);

      if (!shouldIncludeCredentials || init?.credentials) {
        return originalFetch(input, init);
      }

      if (input instanceof Request) {
        return originalFetch(new Request(input, { credentials: "include" }));
      }

      return originalFetch(input, {
        ...init,
        credentials: "include"
      });
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const clearSession = () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setToken(null);
    setUser(null);
  };

  const persistSession = (nextUser: AuthUser) => {
    localStorage.setItem(tokenKey, sessionTokenValue);
    localStorage.setItem(userKey, JSON.stringify(nextUser));
    setToken(sessionTokenValue);
    setUser(nextUser);
  };

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        persistSession(data.user);
        return true;
      }

      if (res.status === 401) {
        clearSession();
      }

      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenKey);
    const storedUser = readStoredUser();

    if (storedToken || storedUser) {
      setToken(sessionTokenValue);
      setUser(storedUser);
    }

    const restoreSession = async () => {
      const hasActiveSession = await fetchUser();

      if (!hasActiveSession && !storedToken && !storedUser) {
        clearSession();
      }

      setIsReady(true);
    };

    void restoreSession();
  }, []);

  const login = (newToken: string, newUser: AuthUser) => {
    void newToken;
    persistSession(newUser);
    setIsReady(true);
  };

  const logout = () => {
    clearSession();
    void fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => undefined);
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

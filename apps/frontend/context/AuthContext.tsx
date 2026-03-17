 "use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const tokenKey = "traceforge_token";

interface AuthContextType {
  token: string | null;
  isLoggedIn: boolean;
  user: { id: string; email: string } | null;
  login: (token: string, user: { id: string; email: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenKey);
    if (storedToken) {
      setToken(storedToken);
      // Fetch user info if needed
      fetchUser(storedToken);
    }
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {}
  };

  const login = (newToken: string, newUser: { id: string; email: string }) => {
    localStorage.setItem(tokenKey, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    isLoggedIn: !!token,
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


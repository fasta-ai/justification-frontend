"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";

interface User {
  id: string;
  name?: string;
  email?: string;
  [key: string]: any;
}

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function extractUserFromToken(token: string | null): User | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  return { id: payload.sub };
}

function isTokenExpiredOrAboutToExpire(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now() + bufferSeconds * 1000;
}

function saveTokens(tokens: AuthTokens) {
  localStorage.setItem("accessToken", tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem("refreshToken", tokens.refreshToken);
  }
  if (tokens.user) {
    localStorage.setItem("user", JSON.stringify(tokens.user));
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshingRef = useRef<Promise<string | null> | null>(null);

  // Load auth data from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const userData = localStorage.getItem("user");

    if (token) {
      setAccessToken(token);
      const userFromToken = extractUserFromToken(token);
      if (userData && userFromToken) {
        try {
          const parsed = JSON.parse(userData);
          setUser({ ...userFromToken, ...parsed, id: userFromToken.id });
        } catch (e) {
          console.error("Failed to parse user data", e);
          setUser(userFromToken);
        }
      } else if (userFromToken) {
        setUser(userFromToken);
      } else if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (e) {
          console.error("Failed to parse user data", e);
        }
      }
    } else if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }

    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Deduplicate concurrent refresh attempts
    if (refreshingRef.current) return refreshingRef.current;

    const currentToken = localStorage.getItem("accessToken");
    if (currentToken && !isTokenExpiredOrAboutToExpire(currentToken)) {
      setAccessToken(currentToken);
      const userFromToken = extractUserFromToken(currentToken);
      if (userFromToken) setUser((prev) => ({ ...prev, ...userFromToken, id: userFromToken.id }));
      return currentToken;
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      logout();
      return null;
    }

    const refreshPromise = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          throw new Error("Refresh failed");
        }

        const data: AuthTokens = await response.json();
        saveTokens(data);
        setAccessToken(data.accessToken);
        const userFromToken = extractUserFromToken(data.accessToken);
        const mergedUser = userFromToken
          ? { ...data.user, ...userFromToken, id: userFromToken.id }
          : data.user;
        setUser(mergedUser || null);
        return data.accessToken;
      } catch (err) {
        console.error("Failed to refresh access token", err);
        logout();
        return null;
      }
    })();

    refreshingRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      refreshingRef.current = null;
    }
  }, [logout]);

  // Periodic token refresh while the app is open
  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem("accessToken");
      if (token && isTokenExpiredOrAboutToExpire(token)) {
        refreshAccessToken();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [refreshAccessToken]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, logout, refreshAccessToken }}
    >
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

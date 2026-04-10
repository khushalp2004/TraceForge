import type { Request, Response } from "express";

const cookieName = process.env.AUTH_COOKIE_NAME?.trim() || "traceforge_session";
const isProduction = process.env.NODE_ENV === "production";
const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
const sameSite =
  configuredSameSite === "strict" || configuredSameSite === "lax" || configuredSameSite === "none"
    ? configuredSameSite
    : isProduction
      ? "none"
      : "lax";
const secure = sameSite === "none" ? true : process.env.AUTH_COOKIE_SECURE === "true" || isProduction;
const domain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
const maxAgeMs = 24 * 60 * 60 * 1000;

const parseCookieHeader = (cookieHeader?: string) => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey?.trim();
    if (!key) {
      return acc;
    }

    acc[key] = decodeURIComponent(rawValue.join("=").trim());
    return acc;
  }, {});
};

export const readAuthTokenFromRequest = (req: Request) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[cookieName] || "";
};

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite: sameSite as "lax" | "strict" | "none",
    path: "/",
    domain,
    maxAge: maxAgeMs
  });
};

export const clearAuthCookie = (res: Response) => {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure,
    sameSite: sameSite as "lax" | "strict" | "none",
    path: "/",
    domain
  });
};

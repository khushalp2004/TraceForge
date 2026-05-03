import http from "k6/http";
import { check } from "k6";

export function loginAndGetCookie(baseUrl, email, password) {
  const response = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({
      email,
      password
    }),
    {
      headers: {
        "Content-Type": "application/json"
      },
      redirects: 0
    }
  );

  check(response, {
    "login succeeded": (res) => res.status === 200
  });

  if (response.status !== 200) {
    throw new Error(
      `Login failed with status ${response.status}. Body: ${String(response.body || "").slice(0, 500)}`
    );
  }

  const cookieEntries = response.cookies?.traceforge_session;
  if (cookieEntries?.length) {
    return `traceforge_session=${cookieEntries[0].value}`;
  }

  const setCookie = response.headers["Set-Cookie"] || response.headers["set-cookie"];
  if (!setCookie) {
    throw new Error(
      `Login succeeded but no auth cookie was returned. Available headers: ${Object.keys(
        response.headers || {}
      ).join(", ")}`
    );
  }

  return Array.isArray(setCookie) ? setCookie[0].split(";")[0] : setCookie.split(";")[0];
}

export function authHeaders(cookie) {
  return {
    headers: {
      Cookie: cookie
    }
  };
}

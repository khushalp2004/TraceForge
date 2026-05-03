import http from "k6/http";
import { check, sleep } from "k6";
import { loginAndGetCookie } from "./helpers/auth.js";

const baseUrl = __ENV.K6_BASE_URL || "http://127.0.0.1:3001";
const email = __ENV.K6_EMAIL || "";
const password = __ENV.K6_PASSWORD || "";
const orgId = __ENV.K6_ORG_ID || "";

const vus = Number(__ENV.K6_VUS || 50);
const duration = __ENV.K6_DURATION || "2m";
const pauseSeconds = Number(__ENV.K6_SLEEP_SECONDS || 0.5);

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1200", "p(99)<2500"]
  }
};

export function setup() {
  if (!email || !password) {
    throw new Error("Set K6_EMAIL and K6_PASSWORD before running authenticated-dashboard.js");
  }

  const cookie = loginAndGetCookie(baseUrl, email, password);
  return { cookie };
}

export default function (data) {
  const authHeaders = {
    headers: {
      Cookie: data.cookie
    }
  };

  const usageQuery = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
  const requests = http.batch([
    ["GET", `${baseUrl}/auth/me`, null, authHeaders],
    ["GET", `${baseUrl}/auth/usage${usageQuery}`, null, authHeaders],
    ["GET", `${baseUrl}/projects`, null, authHeaders],
    ["GET", `${baseUrl}/orgs`, null, authHeaders],
    ["GET", `${baseUrl}/alerts/projects`, null, authHeaders]
  ]);

  check(requests[0], {
    "auth me ok": (res) => res.status === 200
  });
  check(requests[1], {
    "usage ok": (res) => res.status === 200
  });
  check(requests[2], {
    "projects ok": (res) => res.status === 200
  });
  check(requests[3], {
    "orgs ok": (res) => res.status === 200
  });
  check(requests[4], {
    "alerts projects ok": (res) => res.status === 200
  });

  sleep(pauseSeconds);
}

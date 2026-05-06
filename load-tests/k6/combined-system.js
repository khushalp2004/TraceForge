import http from "k6/http";
import { check, sleep } from "k6";
import { authHeaders, loginAndGetCookie } from "./helpers/auth.js";

const baseUrl = __ENV.K6_BASE_URL || "http://127.0.0.1:80";
const email = __ENV.K6_EMAIL || "";
const password = __ENV.K6_PASSWORD || "";
const orgId = __ENV.K6_ORG_ID || "";
const errorId = __ENV.K6_ERROR_ID || "";

const pauseSeconds = Number(__ENV.LT_SLEEP_SECONDS || __ENV.K6_SLEEP_SECONDS || 0.75);
const dashboardRate = Number(__ENV.LT_DASHBOARD_RATE || __ENV.K6_DASHBOARD_RATE || 20);
const queueRate = Number(__ENV.LT_QUEUE_RATE || __ENV.K6_QUEUE_RATE || 5);
const preAllocatedVUs = Number(__ENV.LT_PREALLOCATED_VUS || __ENV.K6_PREALLOCATED_VUS || 30);
const maxVUs = Number(__ENV.LT_MAX_VUS || __ENV.K6_MAX_VUS || 300);
const duration = __ENV.LT_DURATION || "2m";

export const options = {
  scenarios: {
    dashboard_reads: {
      executor: "constant-arrival-rate",
      rate: dashboardRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: Math.floor(preAllocatedVUs * 0.8),
      maxVUs: Math.floor(maxVUs * 0.8),
      exec: "dashboardScenario"
    },
    queue_writes: {
      executor: "constant-arrival-rate",
      rate: queueRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: Math.floor(preAllocatedVUs * 0.2),
      maxVUs: Math.floor(maxVUs * 0.2),
      exec: "queueScenario"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000", "p(99)<4000"]
  }
};

export function setup() {
  if (!email || !password) {
    throw new Error("Set K6_EMAIL and K6_PASSWORD before running combined-system.js");
  }

  return {
    cookie: loginAndGetCookie(baseUrl, email, password)
  };
}

export default function (data) {
  const headers = authHeaders(data.cookie);
  const usageQuery = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";

  // Single batched dashboard call instead of 6 separate calls
  const dashboard = http.get(`${baseUrl}/api/dashboard${usageQuery}`, headers);
  check(dashboard, { "dashboard data ok": (res) => res.status === 200 });

  if (errorId) {
    const queueResponse = http.post(
      `${baseUrl}/errors/${errorId}/regenerate`,
      null,
      headers
    );

    check(queueResponse, {
      "queue worker accepted": (res) => res.status === 202 || res.status === 200
    });
  }

  sleep(Math.max(0.5, pauseSeconds));
}

export function dashboardScenario(data) {
  const headers = authHeaders(data.cookie);
  const usageQuery = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";

  const authMe = http.get(`${baseUrl}/api/auth/me`, headers);
  check(authMe, { "dashboard auth me ok": (res) => res.status === 200 });
  sleep(Math.max(0.2, pauseSeconds * 0.3));

  const usage = http.get(`${baseUrl}/api/auth/usage${usageQuery}`, headers);
  check(usage, { "dashboard usage ok": (res) => res.status === 200 });
  sleep(Math.max(0.2, pauseSeconds * 0.3));

  const dashboardBatch = http.batch([
    ["GET", `${baseUrl}/api/projects`, null, headers],
    ["GET", `${baseUrl}/api/orgs`, null, headers],
    ["GET", `${baseUrl}/api/alerts/projects`, null, headers],
    ["GET", `${baseUrl}/api/notifications/dismissals`, null, headers]
  ]);

  check(dashboardBatch[0], { "dashboard projects ok": (res) => res.status === 200 });
  check(dashboardBatch[1], { "dashboard orgs ok": (res) => res.status === 200 });
  check(dashboardBatch[2], { "dashboard alerts ok": (res) => res.status === 200 });
  check(dashboardBatch[3], { "dashboard notifications ok": (res) => res.status === 200 });

  sleep(Math.max(0.4, pauseSeconds * 0.5));
}

export function queueScenario(data) {
  const headers = authHeaders(data.cookie);

  if (errorId) {
    const queueResponse = http.post(
      `${baseUrl}/errors/${errorId}/regenerate`,
      null,
      headers
    );

    check(queueResponse, {
      "queue worker accepted": (res) => res.status === 202 || res.status === 200
    });
  }

  sleep(Math.max(0.5, pauseSeconds));
}

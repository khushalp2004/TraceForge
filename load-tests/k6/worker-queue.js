import http from "k6/http";
import { check, sleep } from "k6";
import { authHeaders, loginAndGetCookie } from "./helpers/auth.js";

const baseUrl = __ENV.K6_BASE_URL || "http://127.0.0.1:3001";
const email = __ENV.K6_EMAIL || "";
const password = __ENV.K6_PASSWORD || "";
const errorId = __ENV.K6_ERROR_ID || "";

const vus = Number(__ENV.K6_VUS || 10);
const duration = __ENV.K6_DURATION || "1m";
const pauseSeconds = Number(__ENV.K6_SLEEP_SECONDS || 1);

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"]
  }
};

export function setup() {
  if (!email || !password) {
    throw new Error("Set K6_EMAIL and K6_PASSWORD before running worker-queue.js");
  }

  if (!errorId) {
    throw new Error("Set K6_ERROR_ID to a real error record before running worker-queue.js");
  }

  return {
    cookie: loginAndGetCookie(baseUrl, email, password)
  };
}

export default function (data) {
  const response = http.post(
    `${baseUrl}/errors/${errorId}/regenerate`,
    null,
    authHeaders(data.cookie)
  );

  check(response, {
    "worker queue request accepted": (res) => res.status === 202 || res.status === 200
  });

  sleep(pauseSeconds);
}

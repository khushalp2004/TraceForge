import http from "k6/http";
import { check, sleep } from "k6";
import { authHeaders, loginAndGetCookie } from "./helpers/auth.js";

const baseUrl = __ENV.K6_BASE_URL || "http://127.0.0.1:3001";
const email = __ENV.K6_EMAIL || "";
const password = __ENV.K6_PASSWORD || "";

const vus = Number(__ENV.K6_VUS || 50);
const duration = __ENV.K6_DURATION || "2m";
const pauseSeconds = Number(__ENV.K6_SLEEP_SECONDS || 0.5);

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1000", "p(99)<2000"]
  }
};

export function setup() {
  if (!email || !password) {
    throw new Error("Set K6_EMAIL and K6_PASSWORD before running realtime-notifications.js");
  }

  return {
    cookie: loginAndGetCookie(baseUrl, email, password)
  };
}

export default function (data) {
  const headers = authHeaders(data.cookie);

  const dismissals = http.get(`${baseUrl}/notifications/dismissals`, headers);
  check(dismissals, {
    "notifications dismissals ok": (res) => res.status === 200
  });

  const markRead = http.post(
    `${baseUrl}/notifications/dismissals`,
    JSON.stringify({
      items: [
        {
          kind: "ALERT",
          notificationKey: `load-test-${__VU}-${__ITER}`
        }
      ]
    }),
    {
      ...headers,
      headers: {
        ...headers.headers,
        "Content-Type": "application/json"
      }
    }
  );

  check(markRead, {
    "notifications mutation ok": (res) => res.status === 201
  });

  sleep(pauseSeconds);
}

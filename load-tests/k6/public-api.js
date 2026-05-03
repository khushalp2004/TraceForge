import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.K6_BASE_URL || "http://127.0.0.1:3001";
const vus = Number(__ENV.K6_VUS || 50);
const duration = __ENV.K6_DURATION || "1m";
const pauseSeconds = Number(__ENV.K6_SLEEP_SECONDS || 0.5);

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<1500"]
  }
};

export default function () {
  const root = http.get(`${baseUrl}/`);
  check(root, {
    "root is healthy": (res) => res.status === 200
  });

  const live = http.get(`${baseUrl}/health/live`);
  check(live, {
    "live health is healthy": (res) => res.status === 200
  });

  const ready = http.get(`${baseUrl}/health/ready`);
  check(ready, {
    "ready health is healthy": (res) => res.status === 200
  });

  sleep(pauseSeconds);
}

# Production Scaling & Optimization Plan

## PRIORITY 1: IMMEDIATE FIXES (Do First)

### 1.1 Separate API and Worker Containers
**Why**: API and workers compete for CPU. Workers need dedicated resources.

**Implementation**:
- Created `apps/backend/src/worker.ts` - dedicated worker entry point
- Update docker-compose.yml to run separate worker containers
- Workers can scale independently based on queue depth

**Docker Compose Changes**:
```yaml
worker:
  build:
    context: ./apps/backend
    dockerfile: Dockerfile
  container_name: traceforge-worker
  command: sh -c "npm install && npm run prisma:generate && npm run worker"
  environment:
    DATABASE_URL: ${DATABASE_URL}
    REDIS_URL: ${REDIS_URL}
    GROQ_API_KEY: ${GROQ_API_KEY}
    WORKER_CONCURRENCY: 5
  depends_on:
    - db
    - redis
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

**Expected Impact**: 30-40% CPU reduction on API container, stable queue processing.

---

### 1.2 Node.js Clustering for API
**Why**: Single Node.js process uses only 1 CPU core. Clustering utilizes all cores.

**Implementation**:
Create `apps/backend/src/cluster.ts`:

```typescript
import cluster from "node:cluster";
import { cpus } from "node:os";
import { createApp } from "./app.js";
import { connectRedis, closeQueues } from "./db/redis.js";
import prisma from "./db/prisma.js";

const numCPUs = cpus().length;

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);
  console.log(`Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const startServer = async () => {
    await connectRedis();
    const app = createApp();
    const port = Number(process.env.PORT || "3001");
    
    app.listen(port, () => {
      console.log(`Worker ${process.pid} listening on port ${port}`);
    });

    const shutdown = async () => {
      await closeQueues();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  };

  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
```

**Update package.json**:
```json
{
  "scripts": {
    "dev": "tsx watch src/cluster.ts",
    "start": "node dist/cluster.js"
  }
}
```

**Expected Impact**: 4-8x throughput increase (depending on CPU cores).

---

### 1.3 NGINX Load Balancer
**Why**: Distribute load across clustered API instances.

**Implementation**:
Create `nginx/nginx.conf`:

```nginx
upstream backend {
  least_conn;
  server backend:3001;
  server backend:3001;
  server backend:3001;
  server backend:3001;
  keepalive 32;
}

server {
  listen 80;
  
  client_max_body_size 1M;
  
  location / {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Request-ID $request_id;
    
    proxy_connect_timeout 5s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
  }
}
```

**Docker Compose**:
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    - backend
```

**Expected Impact**: Better load distribution, connection reuse.

---

## PRIORITY 2: DATABASE OPTIMIZATION

### 2.1 Connection Pooling Tuning
**Current Issue**: Connection pool likely saturated under load.

**Prisma Schema Update**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Connection pool settings
  connection_limit = 20  // Per instance
  pool_timeout = 20
}
```

**Environment Variables**:
```bash
# In docker-compose.yml for each backend instance
DATABASE_URL: postgresql://user:pass@host:5432/db?schema=public&pgbouncer=true&connection_limit=20&pool_timeout=20
```

**Pgbouncer Tuning**:
```yaml
pgbouncer:
  environment:
    DEFAULT_POOL_SIZE: 25
    MAX_CLIENT_CONN: 500
    RESERVE_POOL_SIZE: 5
    RESERVE_POOL_TIMEOUT: 3
```

**Expected Impact**: 50% reduction in DB connection errors.

---

### 2.2 Query Optimization
**Current Issue**: N+1 queries in `/projects` and `/usage` endpoints.

**Fix**: Use Prisma includes/select properly.

**Before (N+1)**:
```typescript
const projects = await prisma.project.findMany({
  where: { userId }
});
// Then loop to fetch orgs, alerts, etc.
```

**After (Single Query)**:
```typescript
const projects = await prisma.project.findMany({
  where: { userId },
  include: {
    organization: {
      select: { id: true, name: true }
    },
    _count: {
      select: { errors: true }
    }
  }
});
```

**Indexing Strategy**:
```sql
-- Add to migrations
CREATE INDEX CONCURRENTLY idx_error_project_id_last_seen 
  ON "Error"(projectId, lastSeen DESC);

CREATE INDEX CONCURRENTLY idx_error_user_id_archived 
  ON "Error"(userId, archivedAt) 
  WHERE archivedAt IS NULL;

CREATE INDEX CONCURRENTLY idx_error_org_id_last_seen 
  ON "Error"(orgId, lastSeen DESC) 
  WHERE orgId IS NOT NULL;
```

**Expected Impact**: 60-80% reduction in query time for dashboard endpoints.

---

### 2.3 Read Replicas (Optional for Later)
**For reads-heavy workloads**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")  // For writes
}
```

---

## PRIORITY 3: CACHING STRATEGY

### 3.1 Redis Caching Layer
**Implementation**: Create cache middleware.

**Create `apps/backend/src/middleware/cache.ts`**:
```typescript
import { Request, Response, NextFunction } from "express";
import { redis } from "../db/redis.js";

export const cache = (ttlSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.method}:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch {
      // Cache miss or error, continue
    }

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      try {
        redis.set(key, JSON.stringify(data), { EX: ttlSeconds });
      } catch {
        // Ignore cache errors
      }
      return originalJson(data);
    };

    next();
  };
};
```

**Apply to endpoints**:
```typescript
// In routes/projects.ts
import { cache } from "../middleware/cache.js";

projectsRouter.get("/", requireAuth, cache(30), async (req, res) => {
  // ... existing code
});

// In routes/orgs.ts
orgsRouter.get("/", requireAuth, cache(60), async (req, res) => {
  // ... existing code
});
```

**Cache TTL Recommendations**:
- User profile: 300s (5 min)
- Projects list: 30s
- Orgs list: 60s
- Usage stats: 60s
- Alerts: 10s (fresher data)

**Cache Invalidation**:
```typescript
// Invalidate on writes
export const invalidateCache = (pattern: string) => {
  const keys = redis.keys(`cache:${pattern}*`);
  if (keys.length) {
    redis.del(...keys);
  }
};

// After project update
await prisma.project.update(...);
await invalidateCache("GET:/projects");
```

**Expected Impact**: 70-90% reduction in DB load for cached endpoints.

---

### 3.2 Aggregated Dashboard Endpoint
**Why**: k6 test makes 6-7 API calls per iteration. Reduce to 1.

**Create `apps/backend/src/routes/dashboard.ts`**:
```typescript
import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { cache } from "../middleware/cache.js";
import { getCachedUserOrgIds } from "../utils/access.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, cache(30), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orgIds = await getCachedUserOrgIds(userId);

  const [projects, orgs, alerts, dismissals] = await Promise.all([
    prisma.project.findMany({
      where: {
        archivedAt: null,
        OR: [{ userId }, { orgId: { in: orgIds } }]
      },
      select: {
        id: true,
        name: true,
        _count: { select: { errors: true } }
      }
    }),
    prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true }
    }),
    prisma.alert.findMany({
      where: {
        project: {
          OR: [{ userId }, { orgId: { in: orgIds } }]
        }
      },
      select: { id: true, severity: true, triggeredAt: true },
      take: 10
    }),
    prisma.notificationDismissal.findMany({
      where: { userId },
      select: { kind: true, notificationKey: true }
    })
  ]);

  return res.json({
    projects,
    orgs,
    alerts,
    dismissals: {
      alerts: dismissals.filter(d => d.kind === "ALERT").map(d => d.notificationKey),
      invites: dismissals.filter(d => d.kind === "INVITE").map(d => d.notificationKey),
      joinRequests: dismissals.filter(d => d.kind === "JOIN_REQUEST").map(d => d.notificationKey)
    }
  });
});
```

**Update k6 test**:
```javascript
// Instead of 6 separate calls:
const dashboard = http.get(`${baseUrl}/dashboard`, headers);
check(dashboard, { "dashboard ok": (res) => res.status === 200 });
```

**Expected Impact**: 6x reduction in HTTP requests, 80% reduction in latency.

---

## PRIORITY 4: QUEUE OPTIMIZATION

### 4.1 Worker Concurrency Tuning
**Current**: Likely default concurrency (too high/low).

**Settings**:
```yaml
worker:
  environment:
    WORKER_CONCURRENCY: 5  # Per worker instance
```

**Scale workers based on queue depth**:
```yaml
worker:
  deploy:
    replicas: 3  # 3 worker instances
```

**Total capacity**: 3 instances × 5 concurrency = 15 concurrent jobs.

---

### 4.2 Queue Backpressure
**Implementation**: Add queue depth check before adding jobs.

```typescript
const getQueueDepth = async () => {
  const counts = await aiGenerateQueue.getJobCounts("waiting", "active");
  return (counts.waiting || 0) + (counts.active || 0);
};

// In regenerate endpoint
const queueDepth = await getQueueDepth();
if (queueDepth > 100) {
  return res.status(503).json({ 
    error: "Queue is at capacity. Please try again later." 
  });
}
```

---

### 4.3 Retry Strategy
**Current**: Already has exponential backoff. Tune it.

```typescript
await aiGenerateQueue.add(
  "generate-error-solution",
  jobData,
  {
    attempts: 5,  // Increased from 3
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
);
```

---

## PRIORITY 5: SYSTEM PROTECTION

### 5.1 Rate Limiting
**Implementation**: Redis-based rate limiter.

**Create `apps/backend/src/middleware/rateLimit.ts`**:
```typescript
import { Request, Response, NextFunction } from "express";
import { redis } from "../db/redis.js";

export const rateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id || req.ip;
    const key = `${options.keyPrefix || "ratelimit"}:${userId}`;
    
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, Math.ceil(options.windowMs / 1000));
      }
      
      if (current > options.maxRequests) {
        return res.status(429).json({ 
          error: "Too many requests. Please slow down." 
        });
      }
    } catch {
      // Redis error, allow request
    }
    
    next();
  };
};
```

**Apply to expensive endpoints**:
```typescript
// In routes/errors.ts
errorsRouter.post(
  "/:id/regenerate",
  rateLimit({ windowMs: 60000, maxRequests: 10, keyPrefix: "regenerate" }),
  regenerateConcurrencyLimit,
  async (req, res) => {
    // ...
  }
);
```

---

### 5.2 Circuit Breaker
**Implementation**: Stop calling failing services.

**Create `apps/backend/src/utils/circuitBreaker.ts`**:
```typescript
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  
  constructor(
    private threshold: number,
    private timeout: number
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "open";
    }
  }
}
```

**Usage**:
```typescript
const groqBreaker = new CircuitBreaker(5, 60000);

// In worker
const completion = await groqBreaker.execute(() => 
  groq.chat.completions.create(...)
);
```

---

### 5.3 Graceful Degradation
**Priority order of what to fail first**:
1. AI generation (nice-to-have)
2. GitHub integration (nice-to-have)
3. Analytics (can be delayed)
4. Real-time notifications (can fallback to polling)
5. Core error tracking (must work)

**Implementation**:
```typescript
// In regenerate endpoint
if (queueDepth > 50) {
  // Still accept but with warning
  await prisma.error.update({
    where: { id: errorId },
    data: { aiStatus: "QUEUED_HIGH" }
  });
}
```

---

## PRIORITY 6: OBSERVABILITY

### 6.1 Metrics to Track
**Add to `apps/backend/src/utils/metrics.ts`**:
```typescript
export const metrics = {
  httpRequestsTotal: new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"]
  }),
  httpRequestDuration: new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration",
    labelNames: ["method", "route"],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),
  dbQueryDuration: new Histogram({
    name: "db_query_duration_seconds",
    help: "Database query duration",
    labelNames: ["operation"],
    buckets: [0.01, 0.05, 0.1, 0.5, 1]
  }),
  queueDepth: new Gauge({
    name: "queue_depth",
    help: "Queue depth",
    labelNames: ["queue"]
  }),
  activeConnections: new Gauge({
    name: "active_connections",
    help: "Active database connections"
  })
};
```

**Prometheus endpoint**:
```typescript
// In app.ts
import { register } from "prom-client";

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
```

---

### 6.2 Logging Strategy
**Structured logging**:
```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label })
  }
});

// In routes
logger.info({ 
  userId, 
  requestId, 
  action: "regenerate",
  duration: Date.now() - start 
}, "AI regeneration requested");
```

---

### 6.3 Dashboard Setup
**Grafana panels**:
1. Request rate (req/sec)
2. Error rate (%)
3. P95 latency
4. CPU usage (%)
5. Memory usage (%)
6. DB connection pool
7. Queue depth
8. Cache hit rate

---

## PRIORITY 7: K6 TEST IMPROVEMENTS

### 7.1 Realistic Traffic Pattern
**Current**: Constant 40 req/sec. Real traffic has spikes.

**Improved test**:
```javascript
export const options = {
  scenarios: {
    steady_load: {
      executor: "constant-arrival-rate",
      rate: 40,
      timeUnit: "1s",
      duration: "5m",
      preAllocatedVUs: 30,
      maxVUs: 100
    },
    spike: {
      executor: "constant-arrival-rate",
      rate: 200,
      timeUnit: "1s",
      duration: "30s",
      startTime: "3m",
      preAllocatedVUs: 50,
      maxVUs: 200
    }
  }
};
```

### 7.2 Threshold Tuning
```javascript
thresholds: {
  http_req_failed: ["rate<0.05"],  // 5% acceptable during spikes
  http_req_duration: ["p(95)<500", "p(99)<1000"]
}
```

---

## IMPLEMENTATION ORDER

1. **Day 1**: Separate worker containers, update docker-compose
2. **Day 1**: Add aggregated dashboard endpoint
3. **Day 2**: Implement caching layer
4. **Day 2**: Add NGINX load balancer
5. **Day 3**: Query optimization + indexing
6. **Day 3**: Connection pool tuning
7. **Day 4**: Node.js clustering
8. **Day 4**: Rate limiting + circuit breakers
9. **Day 5**: Observability (metrics + logging)
10. **Week 2**: K6 test improvements, validate

---

## EXPECTED RESULTS

**After Priority 1-2**:
- 200-300 concurrent users
- <5% error rate
- p95 latency <400ms
- CPU usage <80%

**After Priority 3-4**:
- 400-500 concurrent users
- <1% error rate
- p95 latency <300ms
- CPU usage <70%

**After Priority 5-7**:
- 500+ concurrent users
- <0.5% error rate
- p95 latency <250ms
- Stable under spikes

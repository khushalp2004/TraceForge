<div align="center">
  <img src="https://res.cloudinary.com/drri6ut0i/image/upload/v1779566028/traceforge/traceforge-logo.png" width="120" alt="TraceForge Logo" />
  <h1>TraceForge</h1>
  <p><strong>Intelligent Error Monitoring for Modern Engineering Teams.</strong></p>
  <p>TraceForge bridges the gap between <i>"something broke"</i> and <i>"here is the PR to fix it."</i></p>
</div>

---

## ⚡️ What is TraceForge?

TraceForge is an open-source, AI-powered APM and error tracking platform. Instead of giving you a firehose of unreadable stack traces, TraceForge automatically groups noise, provides instant AI-driven root-cause analysis, and routes context-rich tickets directly into your team's workflow (Slack, Jira, GitHub).

**Built for speed, scale, and sanity.**

### ✨ Key Features

- 🤖 **AI-Assisted Diagnostics:** Uses advanced LLMs (via Groq) to instantly analyze stack traces and suggest exact code fixes.
- 📊 **Smart Grouping:** Reduces alert fatigue by intelligently grouping related errors into single incidents.
- 🔗 **Deep Integrations:** Native support for Jira, Slack, and GitHub. Open issues and PRs directly from the dashboard.
- 🚄 **High-Performance Infrastructure:** Built with a scalable Node.js/Express backend, Redis for high-speed queues, and PostgreSQL.
- 🎨 **Beautiful Developer Experience:** A sleek, dark-mode first Next.js frontend built for speed and aesthetics.
- 📦 **Universal SDK:** Drop-in Node.js SDK (`usetraceforge`) to start capturing errors in seconds.

---

## 🏗️ Architecture & Tech Stack

TraceForge is a modern monorepo built for enterprise scale:

- **Frontend:** Next.js 14, TailwindCSS, Framer Motion
- **Backend:** Node.js, Express, Prisma ORM
- **Queue & Workers:** Redis, BullMQ, Dedicated AI Worker
- **Database:** PostgreSQL
- **AI Models:** Groq
- **Infrastructure:** Fully Dockerized (Nginx reverse proxy, multi-stage builds)

---

## 🚀 Getting Started (Self-Hosted)

Get TraceForge running locally in under 3 minutes.

### 1. Prerequisites
- Docker & Docker Compose
- Node.js 20+

### 2. Environment Setup
Copy the example environment file and add your `GROQ_API_KEY` (Free from groq.com):
```bash
cp .env.example .env
```

### 3. Start the Platform
Run the unified Docker Compose stack:
```bash
docker compose up -d --build
```
*Note: Database migrations will apply automatically when the backend boots.*

### 4. Access the Services
- **Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API:** [http://localhost:3001](http://localhost:3001)

---

## 🔌 Using the SDK

Start monitoring your Node.js apps instantly.

```bash
npm install usetraceforge
```

```typescript
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: "YOUR_PROJECT_API_KEY",
  autoCapture: true, // Automatically catches unhandled exceptions
  environment: "production",
});

// Or manually capture errors:
try {
  throw new Error("Database connection failed");
} catch (error) {
  TraceForge.captureException(error);
}
```

---

## 🤝 Contributing
We welcome contributions! Whether it's adding new SDKs (Python, Go, Java), improving the AI heuristics, or squashing bugs, feel free to open a Pull Request.

## 📄 License
TraceForge is licensed under the MIT License. Built for calmer production environments.

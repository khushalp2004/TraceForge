TraceForge Enhancements Roadmap
This document outlines the major upcoming features and enhancements planned for the TraceForge platform.

1. Source Maps Support (De-minification)
Problem: Production React, Next.js, and other frontend frameworks minify their code, resulting in unreadable stack traces like `chunk.min.js:1:4390`.
Solution: Build an upload system where the CLI, Webpack plugin, or Vite plugin automatically uploads `.map` files during the build process.
Backend: Implement a parser on the TraceForge backend using Mozilla's `source-map` library to map the minified stack trace back to the exact original line of code (e.g., `Home.tsx:42`).
2. Breadcrumbs (Session Tracking)
Problem: Knowing the error is often not enough; developers need to know what the user did right before the crash.
Solution: Update the SDKs to intercept and store a rolling buffer of the last 20-50 user actions.
Events to Track:
DOM Clicks (e.g., "User clicked 'Submit' button")
Console Logs (`console.log`, `console.warn`)
Network Requests (intercepting `fetch` and `XHR`)
Route Changes (Next.js/React Router navigations)
Implementation: When an error is caught, attach the breadcrumb array to the error payload and display it in the dashboard as a timeline.
3. Performance & Web Vitals Monitoring
Problem: TraceForge only tracks crashes, but slow performance is also a critical issue.
Solution: Expand the SDKs to automatically measure and report Core Web Vitals and API latency.
Metrics:
LCP (Largest Contentful Paint)
FID (First Input Delay) / INP (Interaction to Next Paint)
CLS (Cumulative Layout Shift)
TTFB (Time to First Byte)
Dashboard: Build a Performance tab in the TraceForge frontend to visualize P50, P90, and P99 load times.
4. Error Grouping & Alerting (Fingerprinting)
Problem: If a bug affects 10,000 users, it will create 10,000 duplicate rows in the database, spamming the dashboard.
Solution: Implement intelligent Error Fingerprinting on the backend.
Grouping Algorithm: Hash the error name and the top frames of the stack trace to generate a unique `issue_id`.
Database Updates: Instead of creating a new row, increment an `occurrences` counter and update the `last_seen` timestamp for the existing issue.
Alerting: Wire up an email/Slack notification system to alert developers the first time a new `issue_id` is seen, or if an issue spikes in frequency.
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Workflow,
  Target,
  ShieldAlert,
  Activity,
  Zap,
  Layers,
  ArrowRight
} from "lucide-react";

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 }
  }
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
} as const;

const bentoVariant = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 80, damping: 20 }
  }
} as const;

export default function ProductPage() {
  return (
    <main className="tf-page pb-24 pt-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none -z-10" />
      {/* Dynamic Background Elements */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 -right-64 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], y: [0, -50, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/3 -left-64 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[100px] pointer-events-none mix-blend-screen"
      />

      <div className="tf-container relative z-10">

        {/* --- Hero Section --- */}
        <section className="text-center max-w-4xl mx-auto min-h-[40vh] flex flex-col justify-center mb-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={fadeUpVariant} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6 backdrop-blur-md">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">AI Error Intelligence</span>
            </motion.div>

            <motion.h1 variants={fadeUpVariant} className="tf-title text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tighter">
              Keep production quiet.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Move with confidence.</span>
            </motion.h1>

            <motion.p variants={fadeUpVariant} className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed font-medium max-w-2xl mx-auto">
              Capture exceptions across services, group noisy stacks into clean issues, and
              route them to the right teams with enterprise-grade workflows.
            </motion.p>

            <motion.div variants={fadeUpVariant} className="mt-10 flex flex-wrap gap-4 items-center justify-center">
              <Link href="/signup" className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-[0_0_40px_-10px_rgba(var(--primary),0.6)] transition-all hover:scale-105 hover:bg-primary-hover hover:shadow-[0_0_60px_-15px_rgba(var(--primary),0.8)]">
                Start trial
              </Link>
              <Link href="/docs" className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur px-8 py-4 text-sm font-semibold text-text-primary transition-all hover:bg-secondary hover:border-text-secondary/20">
                View Docs
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* --- Video Demo Component --- */}
        <section className="mb-32">
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 40, damping: 20, delay: 0.2 }}
            className="relative max-w-5xl mx-auto"
          >
            {/* Massive Glow Behind Video */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-accent/30 rounded-[2.5rem] blur-[80px] -z-10" />

            {/* Premium Glassmorphic Browser Mockup */}
            <div className="relative rounded-[2rem] border border-border/80 bg-card/60 p-2 sm:p-3 shadow-2xl backdrop-blur-2xl">
              <div className="rounded-[1.5rem] border border-border/50 bg-background overflow-hidden shadow-inner">

                {/* Browser Header */}
                <div className="flex items-center gap-4 px-5 py-4 border-b border-border/50 bg-secondary/30 relative">
                  <div className="flex gap-1.5 absolute left-5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                    <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                  </div>
                  <div className="mx-auto flex items-center gap-2 bg-card/80 border border-border/50 text-[11px] text-text-secondary px-6 py-1.5 rounded-full font-mono shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    traceforge.com/demo
                  </div>
                </div>

                {/* Video Container */}
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden ">
                  {/* NOTE: You can replace this src with your actual demo MP4 URL, or replace the entire video tag with an iframe for YouTube/Vimeo */}
                  <iframe
                    src="https://player.cloudinary.com/embed/?cloud_name=dyv5wyxuz&public_id=xazri9ab0zo7z2ae6znd&player[autoplay]=true&player[loop]=true&player[muted]=true&player[controls]=false&player[show_logo]=false"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                    frameBorder="0"
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-full opacity-90 hover:opacity-100 transition-opacity pointer-events-none select-none"
                  ></iframe>

                  {/* Optional Overlay Play Button (if you want click-to-play instead of autoplay)
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/20 transition-all cursor-pointer group">
                    <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center text-primary-foreground shadow-[0_0_40px_rgba(var(--primary),0.8)] group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 ml-1" fill="currentColor" />
                    </div>
                  </div>
                  */}
                </div>
              </div>
            </div>

            {/* Floating Stats over the mockup (Explanatory Features) */}
            <motion.div
              initial={{ opacity: 0, x: -40, scale: 0.8 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ type: "spring", stiffness: 100, delay: 0.6 }}
              className="hidden lg:flex absolute top-8 -left-16 rounded-2xl border border-border/80 bg-card/90 backdrop-blur px-6 py-4 shadow-2xl flex-col gap-1 z-20"
            >
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">AI Root Cause</span>
              <span className="text-base font-bold text-primary">`user.id` is undefined</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.8 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ type: "spring", stiffness: 100, delay: 0.8 }}
              className="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-20 rounded-2xl border border-border/80 bg-card/90 backdrop-blur px-6 py-4 shadow-2xl flex-col gap-1 z-20"
            >
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Smart Routing</span>
              <span className="text-base font-bold text-success flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Assigned to @backend
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ type: "spring", stiffness: 100, delay: 1.0 }}
              className="hidden lg:flex absolute bottom-12 -left-16 rounded-2xl border border-border/80 bg-card/90 backdrop-blur px-6 py-4 shadow-2xl flex-col gap-1 z-20"
            >
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Full Context</span>
              <span className="text-base font-bold text-accent">Network logs attached</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.8 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ type: "spring", stiffness: 100, delay: 1.2 }}
              className="hidden lg:flex absolute -top-6 right-8 rounded-2xl border border-border/80 bg-card/90 backdrop-blur px-6 py-4 shadow-2xl flex-col gap-1 z-20"
            >
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Release Health</span>
              <span className="text-base font-bold text-text-primary">Failed in PR #1042</span>
            </motion.div>
          </motion.div>
        </section>

        {/* --- Features Bento Grid --- */}
        <section className="mt-20 lg:mt-32">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5"
          >
            {[
              {
                title: "Signal over noise",
                text: "Automatic grouping, fingerprinting, and dedupe for clean issue lists.",
                icon: <Activity className="w-6 h-6 text-primary" />
              },
              {
                title: "Team workflows",
                text: "Invite teams, set roles, and route incidents by org and project.",
                icon: <Workflow className="w-6 h-6 text-primary" />
              },
              {
                title: "AI remediation",
                text: "Root-cause analysis and suggested fixes surfaced where you work.",
                icon: <Zap className="w-6 h-6 text-primary" />
              }
            ].map((feature, idx) => (
              <motion.div key={feature.title} variants={bentoVariant} className="group rounded-[1.5rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 backdrop-blur-md p-6 sm:p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-lg">
                <div className="w-12 h-12 rounded-xl bg-background border border-border/50 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-3">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{feature.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* --- Interactive SVG Architecture Trace --- */}
        <section className="mt-20 lg:mt-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="rounded-[2.5rem] border border-border/80 bg-gradient-to-b from-card/80 to-background/50 backdrop-blur-xl p-8 lg:p-14 shadow-2xl overflow-hidden relative group"
          >
            {/* Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            <div className="max-w-xl relative z-10 mb-16 text-center mx-auto">
              <h2 className="tf-title text-3xl sm:text-4xl font-bold text-text-primary mb-4">See where it breaks. Instantly.</h2>
              <p className="text-base sm:text-lg text-text-secondary">
                TraceForge connects the entire lifecycle of an error. Watch how a raw exception transforms into an actionable fix.
              </p>
            </div>

            {/* High-End Animated Beam Diagram */}
            <div className="relative h-[400px] w-full flex items-center justify-center max-w-4xl mx-auto z-10">

              {/* Background Glows */}
              <div className="absolute left-[15%] top-1/2 -translate-y-1/2 w-32 h-32 bg-destructive/20 blur-[60px] rounded-full" />
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-48 h-48 bg-primary/20 blur-[80px] rounded-full" />
              <div className="absolute right-[15%] top-1/2 -translate-y-1/2 w-32 h-32 bg-success/20 blur-[60px] rounded-full" />

              <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 1000 400">
                {/* Left Track (Background) */}
                <path d="M 250 200 L 450 200" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" fill="none" className="opacity-50" />

                {/* Animated Trace Pulses (Hover to trigger via CSS or framer-motion) */}
                <motion.circle
                  r="6"
                  fill="rgb(var(--destructive))"
                  className="filter drop-shadow-[0_0_8px_rgba(var(--destructive),1)] opacity-0 group-hover:opacity-100"
                  animate={{
                    cx: [250, 450],
                    cy: [200, 200],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />

                {/* Right Track (Background) */}
                <path d="M 550 200 L 750 200" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" fill="none" className="opacity-50" />

                <motion.circle
                  r="6"
                  fill="rgb(var(--success))"
                  className="filter drop-shadow-[0_0_8px_rgba(var(--success),1)] opacity-0 group-hover:opacity-100"
                  animate={{
                    cx: [550, 750],
                    cy: [200, 200],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: 1.5,
                    ease: "linear"
                  }}
                />
              </svg>

              {/* Node Layout */}
              <div className="absolute inset-0 flex items-center justify-between px-[10%]">

                {/* Source Node (Next.js) */}
                <div className="relative flex flex-col items-center">
                  <div className="w-24 h-24 rounded-[1.25rem] bg-card border border-border/80 shadow-xl flex items-center justify-center relative overflow-hidden group-hover:-translate-y-2 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Layers className="w-10 h-10 text-text-secondary group-hover:text-destructive transition-colors relative z-10" />

                    {/* Animated Border Spin */}
                    <div className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_70%,rgba(var(--destructive),0.3)_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="absolute inset-[1px] bg-card rounded-[1.2rem] z-0" />
                  </div>
                  <div className="mt-4 bg-background border border-border/50 px-3 py-1 rounded-full shadow-sm text-xs font-semibold text-text-primary">
                    Next.js App
                  </div>
                </div>

                {/* Engine Node (TraceForge AI) */}
                <div className="relative flex flex-col items-center z-20 relative top-[-10px]">
                  <div className="w-32 h-32 rounded-3xl bg-gradient-to-b from-card to-background border border-primary/30 shadow-[0_0_40px_rgba(var(--primary),0.15)] flex items-center justify-center relative overflow-hidden group-hover:scale-105 group-hover:shadow-[0_0_60px_rgba(var(--primary),0.3)] transition-all duration-700">
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                    <Zap className="w-12 h-12 text-primary relative z-10 group-hover:scale-110 transition-transform duration-500" />

                    {/* Magical Ambient Inner Glow */}
                    <div className="absolute w-20 h-20 bg-primary/30 blur-2xl rounded-full animate-pulse" />

                    {/* Glowing rotating border */}
                    <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_60%,rgba(var(--primary),0.8)_100%)] opacity-50" />
                    <div className="absolute inset-[1px] bg-card rounded-[1.4rem] z-0" />
                  </div>
                  <div className="mt-5 text-center">
                    <div className="text-sm font-bold text-primary tracking-wide">TraceForge AI</div>
                  </div>
                </div>

                {/* Destination Node (GitHub/Fix) */}
                <div className="relative flex flex-col items-center">
                  <div className="w-24 h-24 rounded-[1.25rem] bg-card border border-border/80 shadow-xl flex items-center justify-center relative overflow-hidden group-hover:-translate-y-2 transition-transform duration-500 delay-100">
                    <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Target className="w-10 h-10 text-text-secondary group-hover:text-success transition-colors relative z-10" />

                    {/* Animated Border Spin */}
                    <div className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_70%,rgba(var(--success),0.3)_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="absolute inset-[1px] bg-card rounded-[1.2rem] z-0" />
                  </div>
                  <div className="mt-4 bg-background border border-border/50 px-3 py-1 rounded-full shadow-sm text-xs font-semibold text-text-primary">
                    GitHub PR
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-4 lg:mt-5">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5"
          >
            {[
              {
                title: "Frontend reliability",
                text: "Client-side exceptions, source maps, and replay context for fast debugging.",
                icon: <Layers className="w-5 h-5 text-accent" />
              },
              {
                title: "Backend safeguards",
                text: "API and worker errors grouped with release and environment visibility.",
                icon: <ShieldAlert className="w-5 h-5 text-accent" />
              },
              {
                title: "Observability handoff",
                text: "Tag incidents and forward to Slack, PagerDuty, or Jira when needed.",
                icon: <Target className="w-5 h-5 text-accent" />
              }
            ].map((feature) => (
              <motion.div key={feature.title} variants={bentoVariant} className="group flex flex-col justify-between rounded-[1.5rem] border border-border/80 bg-card/60 backdrop-blur p-6 hover:bg-card/90 transition-all duration-300 shadow-sm hover:shadow-md">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      {feature.icon}
                    </div>
                    <p className="font-bold text-text-primary">{feature.title}</p>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{feature.text}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* --- Workflow Steps --- */}
        <section className="mt-20 lg:mt-32 tf-frame rounded-[2rem] bg-secondary/30 backdrop-blur p-8 lg:p-12 border border-border/80">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <p className="tf-kicker mb-3">Workflow</p>
              <h2 className="tf-title text-3xl lg:text-4xl">From error to resolution in minutes.</h2>
              <p className="mt-5 text-base sm:text-lg text-text-secondary leading-relaxed">
                TraceForge connects error telemetry with ownership, so teams move fast
                without losing accountability.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid gap-4 sm:grid-cols-2"
            >
              {[
                { step: "1", title: "Capture", text: "Errors land with full context." },
                { step: "2", title: "Group", text: "Noise collapses into issues." },
                { step: "3", title: "Route", text: "Owners approve access." },
                { step: "4", title: "Resolve", text: "AI briefs guide the fix." }
              ].map((item) => (
                <motion.div key={item.step} variants={bentoVariant} className="rounded-2xl border border-border bg-card p-5 hover:-translate-y-1 transition-transform shadow-sm hover:shadow-md">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mb-3">
                    {item.step}
                  </div>
                  <p className="text-base font-bold text-text-primary mb-1">{item.title}</p>
                  <p className="text-sm text-text-secondary">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* --- Launch CTA --- */}
        <section className="mt-20 lg:mt-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative rounded-[2rem] border border-border/80 bg-gradient-to-br from-card to-accent-soft/30 overflow-hidden p-8 sm:p-12 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-8"
          >
            <div>
              <p className="tf-kicker mb-3">Launch</p>
              <h2 className="tf-title text-2xl sm:text-3xl font-bold text-text-primary">Start shipping calmer releases.</h2>
              <p className="mt-3 text-base text-text-secondary">
                Get TraceForge running in minutes with a single API key.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link href="/signup" className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-bold text-primary-foreground transition-all hover:bg-primary-hover hover:scale-105 shadow-[0_0_30px_-5px_rgba(var(--primary),0.5)]">
                Start trial
              </Link>
              <Link href="/docs" className="inline-flex items-center justify-center rounded-full border border-border bg-background px-8 py-4 text-sm font-bold text-text-primary transition-all hover:bg-secondary">
                Read docs
              </Link>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

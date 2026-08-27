"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

import {
  Zap,
  Workflow,
  ArrowRight,
  ShieldCheck,
  Search,
  MessageSquare,
  Lock,
  Github,
  Terminal,
  Server,
  Fingerprint,
  Cpu,
  BarChart4
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

export default function HomePageClientV2() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const getThemeImage = () => {
    if (!mounted) return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844906/axmuwk3mhltg8ojjnfz1.png";
    switch (theme) {
      case "trace-light": return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844906/uouah7rrsrjve0g45evh.png"; // 👇 REPLACE WITH TRACE LIGHT IMAGE
      case "linen-light": return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844907/imnqtvrmoi4f5yhxzvvh.png";  // 👇 REPLACE WITH MIST LIGHT IMAGE
      case "sage-light": return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844906/gqazljgetewwhdedj5w7.png";   // 👇 REPLACE WITH SAGE LIGHT IMAGE
      case "graphite-dark": return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844906/axmuwk3mhltg8ojjnfz1.png"; // 👇 REPLACE WITH GRAPHITE DARK IMAGE
      case "midnight-dark": return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844906/hwv61coa6ckjmubjutng.png"; // 👇 REPLACE WITH MIDNIGHT DARK IMAGE
      case "plum-dark": return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844906/itjnmuumputbwe6tvcq2.png";     // 👇 REPLACE WITH PLUM DARK IMAGE
      default: return "https://res.cloudinary.com/dyv5wyxuz/image/upload/v1787844906/axmuwk3mhltg8ojjnfz1.png";
    }
  };

  const latestCapabilities = [
    {
      title: "Repo analysis",
      text: "Generate a structured GitHub repo report with architecture, runtime flow, entry points, and onboarding notes.",
      icon: <Search className="w-6 h-6 text-primary" />,
      colSpan: "md:col-span-2"
    },
    {
      title: "GitHub issue creation",
      text: "Create a GitHub issue from any error page without leaving.",
      icon: <Github className="w-6 h-6 text-accent" />,
      colSpan: "md:col-span-1"
    },
    {
      title: "Project-aware AI",
      text: "Choose an AI model per project and give teams clear limits.",
      icon: <Zap className="w-6 h-6 text-success" />,
      colSpan: "md:col-span-1"
    },
    {
      title: "Slack + Jira routing",
      text: "Connect workspace integrations and send alert context directly.",
      icon: <MessageSquare className="w-6 h-6 text-primary" />,
      colSpan: "md:col-span-2"
    }
  ];

  return (
    <main className="tf-page pb-24 pt-10 overflow-hidden relative">
      {/* Background Ambience */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none -z-10" />

      <div className="tf-container relative z-10">

        {/* --- Hero Section (Split Layout) --- */}
        <section className="max-w-[1400px] mx-auto pt-10 pb-20 grid lg:grid-cols-2 gap-8 lg:gap-10 items-center min-h-[70vh]">

          {/* Left Side: App Quote & CTA */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-start text-left z-20"
          >
            <motion.div variants={fadeUpVariant} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 mb-8 backdrop-blur-md shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Next-generation error monitoring</span>
            </motion.div>

            <motion.h1 variants={fadeUpVariant} className="tf-title text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tighter max-w-2xl">
              Turn stack traces into <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x bg-[length:200%_auto]">actionable fixes.</span>
            </motion.h1>

            <motion.p variants={fadeUpVariant} className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed font-medium max-w-xl">
              TraceForge captures production errors, uses AI to instantly diagnose the root cause, and routes context-rich tickets directly to your team's workflow.
            </motion.p>

            <motion.div variants={fadeUpVariant} className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
              <Link href="/signup" className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-[0_0_40px_-10px_rgba(var(--primary),0.6)] transition-all hover:scale-105 hover:bg-primary-hover hover:shadow-[0_0_60px_-10px_rgba(var(--primary),0.8)] w-full sm:w-auto">
                Start building free <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/docs" className="group inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/50 backdrop-blur px-8 py-4 text-base font-bold text-text-primary transition-all hover:bg-secondary hover:border-text-secondary/30 w-full sm:w-auto shadow-sm">
                <Terminal className="w-4 h-4 text-text-secondary" /> Explore Docs
              </Link>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="mt-8 flex flex-wrap items-center gap-6 text-sm font-semibold text-text-secondary opacity-80">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> No credit card</span>
              <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-500" /> SOC 2 Ready</span>
              <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> 3-min setup</span>
            </motion.div>
          </motion.div>

          {/* Right Side: Product Demo Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 40, damping: 20, delay: 0.2 }}
            className="relative w-full z-10 animate-float-slow"
          >
            {/* Massive Glow Behind Video */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-accent/30 rounded-[2.5rem] blur-[80px] -z-10" />

            {/* Premium Glassmorphic Browser Mockup */}
            <div className="relative rounded-[2rem] border border-border/80 bg-card/60 p-2 sm:p-3 shadow-2xl backdrop-blur-2xl transform rotate-1 hover:rotate-0 transition-transform duration-700 hover:scale-[1.02]">
              <div className="rounded-[1.5rem] border border-border/50 bg-background overflow-hidden shadow-inner flex flex-col">

                {/* Browser Header */}
                <div className="flex items-center gap-4 px-5 py-4 border-b border-border/50 bg-secondary/30 relative">
                  <div className="flex gap-1.5 absolute left-5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                    <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                  </div>
                  <div className="mx-auto flex items-center gap-2 bg-card/80 border border-border/50 text-[11px] text-text-secondary px-6 py-1.5 rounded-full font-mono shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    traceforge.app/demo
                  </div>
                </div>

                {/* Dashboard / Demo Content */}
                <div className="relative bg-[radial-gradient(ellipse_at_center,rgba(var(--background),1)_0%,rgba(var(--secondary),0.4)_100%)] flex flex-col items-center justify-center p-0 overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />

                  {/* Image Placeholder */}
                  <div className="relative z-10 w-full flex items-center justify-center">
                    {/* Make sure your images are placed inside the 'apps/frontend/public' folder */}
                    <img
                      src={getThemeImage()}
                      alt={`App Screenshot Placeholder (${mounted ? theme : 'default'})`}
                      className="w-full h-auto object-contain rounded-b-[1.5rem] shadow-2xl pointer-events-none select-none"
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* --- Trusted Marquee --- */}
        <section className="mb-24 relative max-w-[1400px] mx-auto overflow-hidden">
          <div
            className="tf-marquee opacity-50"
            style={{
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
              maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
            }}
          >
            <div className="tf-marquee-track">
              {["Next.js", "React", "Node.js", "Python", "Go", "Java", "Kubernetes", "AWS", "Vercel", "GitHub", "Slack", "Jira"].map((item) => (
                <span key={`mq-1-${item}`} className="tf-marquee-item px-8 font-bold text-lg tracking-tight text-text-secondary">
                  {item}
                </span>
              ))}
              {["Next.js", "React", "Node.js", "Python", "Go", "Java", "Kubernetes", "AWS", "Vercel", "GitHub", "Slack", "Jira"].map((item) => (
                <span key={`mq-2-${item}`} className="tf-marquee-item px-8 font-bold text-lg tracking-tight text-text-secondary">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* --- What is TraceForge? (The Why) --- */}
        <section className="mt-20 lg:mt-32 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="tf-kicker mb-4">Why TraceForge?</p>
            <h2 className="tf-title text-3xl sm:text-5xl font-bold">More than just an error feed.</h2>
            <p className="mt-5 text-lg text-text-secondary max-w-2xl mx-auto">
              Traditional APM tools give you a firehose of unreadable stack traces. TraceForge is designed to bridge the gap between "something broke" and "here is the PR to fix it."
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-[2rem] border border-border bg-card/40 p-8 hover:bg-card/80 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Fingerprint className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Intelligent Grouping</h3>
              <p className="text-text-secondary leading-relaxed">
                We use advanced fingerprinting to collapse millions of noisy events into a single, actionable issue thread that stays stable across deployments.
              </p>
            </div>
            <div className="rounded-[2rem] border border-border bg-card/40 p-8 hover:bg-card/80 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                <Cpu className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Root Cause</h3>
              <p className="text-text-secondary leading-relaxed">
                Every captured exception is analyzed by an LLM that reads your stack trace and writes a human-readable summary of exactly what failed and why.
              </p>
            </div>
            <div className="rounded-[2rem] border border-border bg-card/40 p-8 hover:bg-card/80 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-6">
                <Workflow className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-xl font-bold mb-3">End-to-End Workflow</h3>
              <p className="text-text-secondary leading-relaxed">
                Connect your workspace to push alerts to Slack, create Jira tickets, and automatically generate GitHub PRs with suggested fixes.
              </p>
            </div>
          </div>
        </section>

        {/* --- High-End Bento Grid (Restored!) --- */}
        <section className="mt-20 lg:mt-40 mb-32 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="tf-title text-3xl sm:text-5xl font-bold mb-6">Everything you need to ship calmer releases.</h2>
            <p className="text-lg text-text-secondary">A unified platform for observability, team collaboration, and AI-driven remediation.</p>
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {latestCapabilities.map((feature) => (
              <motion.div
                key={feature.title}
                variants={bentoVariant}
                className={`group relative rounded-[2.5rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 backdrop-blur-xl p-8 lg:p-10 hover:-translate-y-2 transition-all duration-500 shadow-lg hover:shadow-2xl overflow-hidden ${feature.colSpan}`}
              >
                {/* Hover Glow */}
                <div className="absolute -inset-px bg-gradient-to-br from-primary/30 to-accent/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2.5rem] -z-10 blur-md" />

                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-background/80 border border-border/50 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 backdrop-blur-md">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-text-primary mb-4">{feature.title}</h3>
                  <p className="text-text-secondary text-base lg:text-lg leading-relaxed">{feature.text}</p>
                </div>

                {/* Decorative Background Element inside card */}
                <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-700 translate-x-1/4 translate-y-1/4 pointer-events-none">
                  {feature.icon}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* --- Outcomes & Security Split --- */}
        <section className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-[2.5rem] border border-border/60 bg-gradient-to-br from-card to-background p-10 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <BarChart4 className="w-40 h-40" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4">Proven Reliability Outcomes</h3>
                <p className="text-text-secondary mb-8 leading-relaxed">
                  Teams using TraceForge report significantly lower mean-time-to-resolution (MTTR) and drastically reduced alert fatigue.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <span className="font-semibold text-text-secondary">Alert Noise Reduction</span>
                    <span className="text-2xl font-extrabold text-primary">-62%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <span className="font-semibold text-text-secondary">Median Triage Time</span>
                    <span className="text-2xl font-extrabold text-primary">6 mins</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-border/60 bg-gradient-to-bl from-card to-background p-10 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <ShieldCheck className="w-40 h-40" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4">Enterprise Grade Security</h3>
                <p className="text-text-secondary mb-8 leading-relaxed">
                  Built for regulated environments from day one. Your telemetry data is handled with strict compliance and robust access controls.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-4 py-2 rounded-full bg-background border border-border/50 text-sm font-medium">SOC 2 Type II</span>
                  <span className="px-4 py-2 rounded-full bg-background border border-border/50 text-sm font-medium">SAML / SSO</span>
                  <span className="px-4 py-2 rounded-full bg-background border border-border/50 text-sm font-medium">Audit Logs</span>
                  <span className="px-4 py-2 rounded-full bg-background border border-border/50 text-sm font-medium">RBAC</span>
                  <span className="px-4 py-2 rounded-full bg-background border border-border/50 text-sm font-medium">Data Retention</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Launch CTA --- */}
        <section className="mt-20 lg:mt-32 max-w-5xl mx-auto text-center mb-10">
          <h2 className="tf-title text-4xl sm:text-5xl font-extrabold text-text-primary mb-6">Ready to regain control?</h2>
          <p className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto">
            Create a workspace, drop in the SDK, and start seeing AI-summarized insights in minutes. No credit card required.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary-hover w-full sm:w-auto">
              Create your workspace
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-8 py-4 text-base font-bold text-text-primary transition-all hover:bg-secondary w-full sm:w-auto">
              View pricing
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { 
  Terminal, 
  Workflow, 
  GitBranch, 
  Zap, 
  Target, 
  ShieldAlert, 
  CheckCircle2, 
  LineChart, 
  Boxes, 
  Activity,
  Slack,
  Github,
  Trello
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

export default function SolutionsPage() {
  return (
    <main className="tf-page pb-24 pt-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none -z-10" />
      {/* Dynamic Background Elements */}
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 -left-64 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" 
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], y: [0, -50, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/4 -right-64 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[100px] pointer-events-none mix-blend-screen" 
      />

      <div className="tf-container relative z-10">
        
        {/* --- Hero Section --- */}
        <section className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 min-h-[70vh] mb-32">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex-1"
          >
            <motion.div variants={fadeUpVariant} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6 backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Live Resolution</span>
            </motion.div>
            
            <motion.h1 variants={fadeUpVariant} className="tf-title text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tighter">
              Ship Faster. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Sleep Better.</span>
            </motion.h1>
            
            <motion.p variants={fadeUpVariant} className="mt-8 max-w-xl text-lg sm:text-xl text-text-secondary leading-relaxed font-medium">
              TraceForge transforms noisy error logs into a single, calm workflow. AI-powered summaries, instant root-cause analysis, and automatic team routing.
            </motion.p>
            
            <motion.div variants={fadeUpVariant} className="mt-10 flex flex-wrap gap-4 items-center">
              <Link href="/signup" className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-[0_0_40px_-10px_rgba(var(--primary),0.6)] transition-all hover:scale-105 hover:bg-primary-hover hover:shadow-[0_0_60px_-15px_rgba(var(--primary),0.8)]">
                Start for free
                <Zap className="w-4 h-4 transition-transform group-hover:rotate-12" />
              </Link>
              <Link href="/product" className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur px-8 py-4 text-sm font-semibold text-text-primary transition-all hover:bg-secondary hover:border-text-secondary/20">
                Take a tour
                <Target className="w-4 h-4 opacity-50 group-hover:opacity-100" />
              </Link>
            </motion.div>
            
            <motion.div variants={fadeUpVariant} className="mt-12 flex items-center gap-6 text-sm font-medium text-text-secondary">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> 2 min setup</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Free forever tier</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> No credit card</div>
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 50, damping: 20, delay: 0.3 }}
            className="flex-1 relative w-full max-w-2xl animate-float-slow"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-accent/20 rounded-[2.5rem] blur-3xl" />
            <div className="tf-glow-card relative rounded-[2rem] border border-border/50 bg-card/60 p-2 shadow-2xl backdrop-blur-2xl">
              <div className="rounded-[1.5rem] border border-border/50 bg-background/80 overflow-hidden shadow-inner">
                {/* Mockup Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-secondary/30">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/80" />
                    <div className="w-3 h-3 rounded-full bg-warning/80" />
                    <div className="w-3 h-3 rounded-full bg-success/80" />
                  </div>
                  <div className="mx-auto bg-card/80 border border-border/50 text-[10px] text-text-secondary px-4 py-1 rounded-full font-mono">
                    traceforge.com/incident/2491
                  </div>
                </div>
                {/* Mockup Content */}
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="tf-danger-tag px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">High</span>
                        <span className="text-sm font-semibold font-mono text-text-secondary">TypeError</span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-text-primary">Cannot read properties of undefined (reading 'id')</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-text-primary">12.4k</div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">Events</div>
                    </div>
                  </div>
                  
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 relative overflow-hidden group cursor-default">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-primary">AI Root Cause Summary</p>
                        <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                          This crash correlates directly with the <span className="font-mono text-xs px-1 py-0.5 bg-secondary rounded text-text-primary">web@2.4.1</span> release. 
                          The <span className="font-mono text-xs px-1 py-0.5 bg-secondary rounded text-text-primary">user.id</span> object is null during the checkout process when handling guest accounts. 
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 bg-card hover:bg-secondary/80 transition-colors border border-border/50 rounded-lg py-2.5 text-xs font-semibold text-text-primary shadow-sm flex justify-center items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5" /> View PR #1042
                    </button>
                    <button className="flex-1 bg-card hover:bg-secondary/80 transition-colors border border-border/50 rounded-lg py-2.5 text-xs font-semibold text-text-primary shadow-sm flex justify-center items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5" /> Assign to Payments
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* --- Workflow Bento Grid --- */}
        <section className="mt-20 lg:mt-24">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUpVariant}
            className="text-center max-w-2xl mx-auto mb-10"
          >
            <p className="tf-kicker mb-3">Intelligent Workflow</p>
            <h2 className="tf-title text-3xl sm:text-4xl">Decisions, not dashboards.</h2>
            <p className="mt-3 text-text-secondary text-base sm:text-lg">
              TraceForge handles the heavy lifting of context gathering so your team can focus entirely on shipping the fix.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5"
          >
            {/* Bento Box 1 - Large */}
            <motion.div variants={bentoVariant} className="md:col-span-2 group relative overflow-hidden rounded-[1.5rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 backdrop-blur-md p-6 sm:p-8 hover:bg-card/90 transition-all duration-500 shadow-sm hover:shadow-lg">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Boxes className="w-24 h-24 text-primary" />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div>
                  <span className="tf-pill border-primary/20 bg-primary/10 text-primary mb-3">Step 01</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">Intelligent Issue Grouping</h3>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-md">
                    Stop drowning in duplicate stack traces. TraceForge uses advanced fingerprinting to group thousands of identical errors into one actionable issue.
                  </p>
                </div>
                <div className="mt-4 flex gap-3">
                  <div className="flex-1 h-1.5 bg-destructive/20 rounded-full overflow-hidden">
                    <div className="h-full bg-destructive w-full origin-left animate-pulse" />
                  </div>
                  <div className="w-6 shrink-0 flex items-center justify-center text-[10px] font-bold text-text-secondary">⟶</div>
                  <div className="flex-1 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 0.3 }}
                      transition={{ delay: 0.5, duration: 1 }}
                      viewport={{ once: true }}
                      className="h-full bg-primary origin-left" 
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Bento Box 2 */}
            <motion.div variants={bentoVariant} className="group relative overflow-hidden rounded-[1.5rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 backdrop-blur-md p-6 sm:p-8 hover:bg-card/90 transition-all duration-500 shadow-sm hover:shadow-lg">
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div>
                  <span className="tf-pill mb-3">Step 02</span>
                  <h3 className="text-lg font-bold text-text-primary mb-2">AI Remediation</h3>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                    Get a human-readable summary of the exact variable that failed and why, generated instantly.
                  </p>
                </div>
                <div className="bg-background/80 rounded-xl p-3 border border-border/50">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: "75%" }} transition={{ delay: 0.2 }} className="h-1.5 bg-primary/30 rounded mb-1.5" />
                  <motion.div initial={{ width: 0 }} whileInView={{ width: "100%" }} transition={{ delay: 0.3 }} className="h-1.5 bg-border rounded mb-1.5" />
                  <motion.div initial={{ width: 0 }} whileInView={{ width: "83.333333%" }} transition={{ delay: 0.4 }} className="h-1.5 bg-border rounded" />
                </div>
              </div>
            </motion.div>

            {/* Bento Box 3 */}
            <motion.div variants={bentoVariant} className="group relative overflow-hidden rounded-[1.5rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 backdrop-blur-md p-6 sm:p-8 hover:bg-card/90 transition-all duration-500 shadow-sm hover:shadow-lg">
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div>
                  <span className="tf-pill mb-3">Step 03</span>
                  <h3 className="text-lg font-bold text-text-primary mb-2">Release Health</h3>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                    Instantly correlate new spikes in errors with your latest deployments and commits.
                  </p>
                </div>
                <div className="flex items-end gap-1.5 h-12 pt-2 border-b border-border/50 overflow-hidden">
                  {[40, 25, 60, 30, 90, 45, 20].map((h, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                      viewport={{ once: true }}
                      className="flex-1 bg-primary/20 rounded-t-sm transition-colors duration-500 group-hover:bg-primary/40" 
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Bento Box 4 - Large */}
            <motion.div variants={bentoVariant} className="md:col-span-2 group relative overflow-hidden rounded-[1.5rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 backdrop-blur-md p-6 sm:p-8 hover:bg-card/90 transition-all duration-500 shadow-sm hover:shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center h-full">
                <div className="flex-1">
                  <span className="tf-pill mb-3">Step 04</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">Targeted Team Routing</h3>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                    TraceForge knows exactly which team owns which repository. Alerts are routed cleanly to the right Slack channels and Jira boards instantly.
                  </p>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2.5 w-full">
                  <motion.div whileHover={{ scale: 1.05 }} className="bg-background/80 rounded-xl p-2.5 border border-border/50 flex items-center gap-2.5 shadow-sm transition-transform cursor-pointer">
                    <Slack className="w-4 h-4 text-text-secondary" />
                    <span className="text-[11px] font-semibold">#payments-alerts</span>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} className="bg-background/80 rounded-xl p-2.5 border border-border/50 flex items-center gap-2.5 shadow-sm transition-transform cursor-pointer">
                    <Terminal className="w-4 h-4 text-text-secondary" />
                    <span className="text-[11px] font-semibold">frontend-core</span>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} className="bg-background/80 rounded-xl p-2.5 border border-border/50 flex items-center gap-2.5 shadow-sm col-span-2 transition-transform cursor-pointer">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[11px] font-semibold">Auto-assigned to @sarah</span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* --- Infinite Marquee (Integrations) --- */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mt-20 lg:mt-24 pb-8 border-b border-border/30"
        >
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-text-secondary mb-3">Integrates with your stack</p>
          </div>
          <div className="tf-marquee">
            <div className="tf-marquee-track">
              {/* Double up items for smooth infinite scroll */}
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-10 sm:gap-16 items-center px-4">
                  <div className="flex items-center gap-2.5 text-text-secondary font-bold text-lg sm:text-xl grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                    <Github className="w-6 h-6 sm:w-8 sm:h-8" /> GitHub
                  </div>
                  <div className="flex items-center gap-2.5 text-text-secondary font-bold text-lg sm:text-xl grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                    <Slack className="w-6 h-6 sm:w-8 sm:h-8" /> Slack
                  </div>
                  <div className="flex items-center gap-2.5 text-text-secondary font-bold text-lg sm:text-xl grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                    <Trello className="w-6 h-6 sm:w-8 sm:h-8" /> Jira
                  </div>
                  <div className="flex items-center gap-2.5 text-text-secondary font-bold text-lg sm:text-xl grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                    <Terminal className="w-6 h-6 sm:w-8 sm:h-8" /> Linear
                  </div>
                  <div className="flex items-center gap-2.5 text-text-secondary font-bold text-lg sm:text-xl grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                    <Activity className="w-6 h-6 sm:w-8 sm:h-8" /> PagerDuty
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* --- Operating Groups (Asymmetrical Grid) --- */}
        <section className="mt-20 lg:mt-24">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUpVariant}
            className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10"
          >
            <div className="max-w-2xl">
              <p className="tf-kicker mb-3">Built for Everyone</p>
              <h2 className="tf-title text-3xl sm:text-4xl">One platform. Total alignment.</h2>
            </div>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5"
          >
            {[
              {
                icon: <LineChart className="w-4 h-4 text-primary" />,
                title: "Engineering Leaders",
                desc: "See reliability across teams, releases, and ownership boundaries without chasing status updates or manually pulling metrics."
              },
              {
                icon: <Workflow className="w-4 h-4 text-primary" />,
                title: "Platform Teams",
                desc: "Standardize capture, routing, and alerting across microservices with one predictable, globally enforced workflow."
              },
              {
                icon: <Target className="w-4 h-4 text-primary" />,
                title: "Product Teams",
                desc: "Connect technical failures directly to customer impact so the next sprint fixes what users actually feel."
              }
            ].map((item, idx) => (
              <motion.div key={idx} variants={bentoVariant} className="group rounded-[1.5rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 backdrop-blur-md p-6 sm:p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center mb-5 shadow-sm group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-2">{item.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* --- Outcomes CTA --- */}
        <section className="mt-20 lg:mt-24">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative rounded-[2rem] border border-border/80 bg-gradient-to-br from-card to-accent-soft/30 overflow-hidden p-8 sm:p-12 lg:p-14 shadow-2xl backdrop-blur-md"
          >
            {/* Theme-aware glow */}
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/10 blur-[90px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-accent/10 blur-[90px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
              <div className="max-w-xl">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-text-primary mb-5 leading-tight">
                  Ready to make shipping feel safe again?
                </h2>
                <p className="text-base sm:text-lg text-text-secondary mb-8">
                  Join the teams that use TraceForge to turn production chaos into a calm, predictable queue of actionable fixes.
                </p>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <Link href="/signup" className="inline-flex items-center justify-center rounded-full bg-primary px-6 sm:px-8 py-3.5 sm:py-4 text-sm font-bold text-primary-foreground transition-all hover:bg-primary-hover hover:scale-105 shadow-[0_0_30px_-5px_rgba(var(--primary),0.5)]">
                    Create free account
                  </Link>
                  <Link href="/pricing" className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 sm:px-8 py-3.5 sm:py-4 text-sm font-bold text-text-primary transition-all hover:bg-secondary">
                    View pricing
                  </Link>
                </div>
              </div>

              {/* Terminal Code Block Visual */}
              <div className="w-full lg:w-auto flex-1 max-w-[26rem]">
                <div className="rounded-[1.5rem] bg-card/80 border border-border/60 p-5 shadow-inner backdrop-blur-xl font-mono text-[13px]">
                  <div className="flex gap-1.5 mb-5">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-success/80" />
                  </div>
                  <div className="space-y-2.5 text-text-primary">
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.2 }} viewport={{ once: true }}>
                      <p><span className="text-primary mr-1">~</span> npm install @traceforge/node</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.8 }} viewport={{ once: true }}>
                      <p className="text-text-secondary">Installing packages...</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1.4 }} viewport={{ once: true }}>
                      <p><span className="text-primary mr-1">~</span> traceforge init</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1.8 }} viewport={{ once: true }}>
                      <p className="text-success flex items-center gap-2">✔ Connected to project</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 2.2 }} viewport={{ once: true }}>
                      <p className="text-success flex items-center gap-2">✔ Listening for exceptions</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 2.6 }} viewport={{ once: true }} className="mt-3 pt-3 border-t border-border/50 text-text-secondary text-[11px]">
                      Zero configuration required.
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import HomeHeroPreview from "./components/HomeHeroPreview";
import { 
  Zap, 
  Activity, 
  Workflow, 
  ArrowRight,
  ShieldCheck,
  Search,
  MessageSquare,
  Lock,
  Github,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Terminal
} from "lucide-react";

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const bentoVariant = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 80, damping: 20 }
  }
};

export default function HomePageClient() {
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
    <main className="tf-page pb-24 pt-20 overflow-hidden relative">
      {/* Dynamic Background Elements - Million Dollar Aesthetic */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-40 -right-40 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen" 
      />
      <motion.div 
        animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 -left-64 w-[700px] h-[700px] bg-accent/20 rounded-full blur-[130px] pointer-events-none mix-blend-screen" 
      />
      
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      <div className="tf-container relative z-10">
        
        {/* --- Hero Section --- */}
        <section className="text-center max-w-5xl mx-auto pt-10 pb-16 flex flex-col items-center justify-center min-h-[60vh]">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center w-full"
          >
            <motion.div variants={fadeUpVariant} className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 mb-8 backdrop-blur-xl shadow-[0_0_20px_rgba(var(--primary),0.1)]">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">TraceForge v2 is now live</span>
            </motion.div>
            
            <motion.h1 variants={fadeUpVariant} className="tf-title text-5xl sm:text-7xl lg:text-[5.5rem] font-extrabold leading-[1.1] tracking-tighter max-w-4xl">
              Make production errors <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x bg-[length:200%_auto]">completely boring.</span>
            </motion.h1>
            
            <motion.p variants={fadeUpVariant} className="mt-8 text-lg sm:text-xl text-text-secondary leading-relaxed font-medium max-w-3xl mx-auto">
              TraceForge groups noisy stack traces into clean issues, generates instant AI summaries, and gives your team the exact context they need to ship fixes in minutes, not hours.
            </motion.p>
            
            <motion.div variants={fadeUpVariant} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
              <Link href="/signup" className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-primary px-10 py-5 text-base font-bold text-primary-foreground shadow-[0_0_40px_-10px_rgba(var(--primary),0.7)] transition-all hover:scale-105 hover:bg-primary-hover hover:shadow-[0_0_60px_-10px_rgba(var(--primary),0.9)] w-full sm:w-auto overflow-hidden">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">Start your free trial <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
              </Link>
              <Link href="/demo" className="group inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card/40 backdrop-blur-lg px-10 py-5 text-base font-bold text-text-primary transition-all hover:bg-card hover:border-text-secondary/30 w-full sm:w-auto shadow-lg hover:shadow-xl">
                <Terminal className="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" />
                Book a Demo
              </Link>
            </motion.div>
            
            <motion.div variants={fadeUpVariant} className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-text-secondary opacity-80">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> No credit card required</span>
              <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-500" /> SOC 2 Type II Certified</span>
              <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Setup in 3 minutes</span>
            </motion.div>
          </motion.div>
        </section>

        {/* --- Hero Visual Centerpiece --- */}
        <section className="relative w-full max-w-6xl mx-auto mb-32 z-20">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 40, damping: 20, delay: 0.3 }}
            className="relative"
          >
            {/* Ambient Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-accent/20 to-primary/30 rounded-[3rem] blur-[100px] -z-10" />
            
            {/* Premium Browser Mockup container */}
            <div className="rounded-[2.5rem] border border-border/80 bg-card/30 p-2 sm:p-4 shadow-[0_0_80px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative">
              
              {/* Floating badges for million-dollar feel */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -left-10 top-1/4 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl px-5 py-4 shadow-2xl hidden lg:flex items-center gap-4 z-30"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Triage Time</p>
                  <p className="text-xl font-extrabold text-text-primary">-65%</p>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -right-8 bottom-1/4 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl px-5 py-4 shadow-2xl hidden lg:flex items-center gap-4 z-30"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">AI Root Cause</p>
                  <p className="text-xl font-extrabold text-text-primary">Instant</p>
                </div>
              </motion.div>

              <div className="rounded-[2rem] border border-border/50 bg-background/80 overflow-hidden shadow-inner relative">
                
                {/* Browser Header */}
                <div className="flex items-center gap-4 px-6 py-4 border-b border-border/40 bg-secondary/40 relative backdrop-blur-md">
                  <div className="flex gap-2 absolute left-6">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] border border-[#E0443E] shadow-sm" />
                    <div className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] border border-[#DEA123] shadow-sm" />
                    <div className="w-3.5 h-3.5 rounded-full bg-[#27C93F] border border-[#1AAB29] shadow-sm" />
                  </div>
                  <div className="mx-auto flex items-center gap-3 bg-card/80 border border-border/40 text-xs text-text-secondary px-8 py-2 rounded-full font-mono shadow-sm">
                    <Lock className="w-3 h-3" />
                    traceforge.app/issues/TRC-892
                  </div>
                </div>

                {/* Dashboard Content Mockup replacing simple video */}
                <div className="relative w-full aspect-[16/9] lg:aspect-[21/9] bg-[radial-gradient(ellipse_at_center,rgba(var(--background),1)_0%,rgba(var(--secondary),0.5)_100%)] flex items-center justify-center overflow-hidden p-8">
                  {/* Grid overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />
                  
                  {/* HomeHeroPreview perfectly integrated into the center */}
                  <div className="scale-100 lg:scale-125 origin-center z-10 transition-transform duration-500">
                    <HomeHeroPreview />
                  </div>
                  
                  {/* Decorative Mock Code on the sides */}
                  <div className="absolute left-10 bottom-10 p-4 rounded-xl border border-border/30 bg-card/40 backdrop-blur font-mono text-[10px] text-text-secondary/70 hidden lg:block max-w-[250px]">
                    <div className="text-primary/70 mb-2">// background-worker.ts</div>
                    <div>{`try {`}</div>
                    <div className="pl-4">{`await processCheckoutQueue();`}</div>
                    <div>{`} catch (error) {`}</div>
                    <div className="pl-4 text-destructive/80">{`TraceForge.captureException(error, {`}</div>
                    <div className="pl-8">{`context: { jobId: job.id }`}</div>
                    <div className="pl-4">{`});`}</div>
                    <div>{`}`}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* --- Trusted Marquee (Premium Styling) --- */}
        <section className="mb-32 relative">
          <div className="text-center mb-8">
            <p className="text-sm font-bold uppercase tracking-widest text-text-secondary">Trusted by engineering teams using</p>
          </div>
          {/* Fading edges */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
          
          <div className="tf-marquee opacity-60 hover:opacity-100 transition-opacity duration-700">
            <div className="tf-marquee-track">
              {[
                "Next.js", "React", "Node.js", "Python", "Go", "Java", "Kubernetes", "AWS", "Vercel", "GitHub", "Slack", "Jira"
              ].map((item) => (
                <span key={`mq-1-${item}`} className="tf-marquee-item px-8 font-bold text-xl tracking-tight text-text-secondary">
                  {item}
                </span>
              ))}
              {[
                 "Next.js", "React", "Node.js", "Python", "Go", "Java", "Kubernetes", "AWS", "Vercel", "GitHub", "Slack", "Jira"
              ].map((item) => (
                <span key={`mq-2-${item}`} className="tf-marquee-item px-8 font-bold text-xl tracking-tight text-text-secondary">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* --- The Workflow Diagram (Interactive SVG Trace) --- */}
        <section className="mt-20 lg:mt-32 relative mb-32">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="rounded-[3rem] border border-border/80 bg-gradient-to-b from-card/80 to-background/50 backdrop-blur-2xl p-10 lg:p-16 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden relative group"
          >
            {/* Inside Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            <div className="text-center max-w-3xl mx-auto mb-20 relative z-10">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-accent/10 text-accent mb-6">
                <Workflow className="w-8 h-8" />
              </div>
              <h2 className="tf-title text-4xl sm:text-5xl font-bold text-text-primary mb-6">See exactly where it breaks.</h2>
              <p className="text-lg text-text-secondary leading-relaxed">
                TraceForge connects the entire lifecycle of an error. Watch a raw exception transform into grouped insights, AI summaries, and actionable pull requests.
              </p>
            </div>

            {/* High-End Animated Beam Diagram */}
            <div className="relative h-[300px] lg:h-[400px] w-full flex items-center justify-center max-w-5xl mx-auto z-10">
              
              {/* Background Glows */}
              <div className="absolute left-[10%] top-1/2 -translate-y-1/2 w-40 h-40 bg-destructive/20 blur-[80px] rounded-full" />
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full" />
              <div className="absolute right-[10%] top-1/2 -translate-y-1/2 w-40 h-40 bg-success/20 blur-[80px] rounded-full" />

              <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none hidden md:block" viewBox="0 0 1000 400">
                {/* Left Track (Background) */}
                <path d="M 200 200 L 450 200" stroke="var(--border)" strokeWidth="3" strokeDasharray="6 6" fill="none" className="opacity-40" />
                
                {/* Animated Trace Pulse Left */}
                <motion.circle 
                  r="8" 
                  fill="rgb(var(--destructive))"
                  className="filter drop-shadow-[0_0_12px_rgba(var(--destructive),1)] opacity-0 group-hover:opacity-100"
                  animate={{ cx: [200, 450], cy: [200, 200] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />

                {/* Right Track (Background) */}
                <path d="M 550 200 L 800 200" stroke="var(--border)" strokeWidth="3" strokeDasharray="6 6" fill="none" className="opacity-40" />
                
                {/* Animated Trace Pulse Right */}
                <motion.circle 
                  r="8" 
                  fill="rgb(var(--success))"
                  className="filter drop-shadow-[0_0_12px_rgba(var(--success),1)] opacity-0 group-hover:opacity-100"
                  animate={{ cx: [550, 800], cy: [200, 200] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 1.5, ease: "linear" }}
                />
              </svg>

              {/* Node Layout */}
              <div className="absolute inset-0 flex flex-col md:flex-row items-center justify-between px-[5%] md:px-[10%] gap-10 md:gap-0">
                
                {/* Source Node (Exception) */}
                <div className="relative flex flex-col items-center">
                  <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-3xl bg-card border border-border/80 shadow-2xl flex items-center justify-center relative overflow-hidden group-hover:-translate-y-3 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <AlertTriangle className="w-12 h-12 text-text-secondary group-hover:text-destructive transition-colors relative z-10" />
                    <div className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_70%,rgba(var(--destructive),0.4)_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="absolute inset-[1px] bg-card rounded-[1.4rem] lg:rounded-[1.8rem] z-0" />
                  </div>
                  <div className="mt-5 bg-background border border-border/50 px-5 py-2 rounded-full shadow-sm text-sm font-bold text-text-primary">
                    Raw Exception
                  </div>
                </div>

                {/* Engine Node (TraceForge AI) */}
                <div className="relative flex flex-col items-center z-20 md:relative md:top-[-15px]">
                  <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-gradient-to-b from-card to-background border border-primary/40 shadow-[0_0_60px_rgba(var(--primary),0.2)] flex items-center justify-center relative overflow-hidden group-hover:scale-110 group-hover:shadow-[0_0_80px_rgba(var(--primary),0.4)] transition-all duration-700">
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                    <Code2 className="w-16 h-16 text-primary relative z-10 group-hover:scale-110 transition-transform duration-500" />
                    
                    {/* Magical Ambient Inner Glow */}
                    <div className="absolute w-24 h-24 bg-primary/40 blur-2xl rounded-full animate-pulse" />
                    
                    {/* Glowing rotating border */}
                    <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_50%,rgba(var(--primary),0.9)_100%)] opacity-70" />
                    <div className="absolute inset-[2px] bg-card rounded-full z-0" />
                  </div>
                  <div className="mt-6 text-center">
                    <div className="text-lg font-extrabold text-primary tracking-wide">TraceForge Engine</div>
                    <p className="text-xs text-text-secondary mt-1">Group & Analyze</p>
                  </div>
                </div>

                {/* Destination Node (Fix) */}
                <div className="relative flex flex-col items-center">
                  <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-3xl bg-card border border-border/80 shadow-2xl flex items-center justify-center relative overflow-hidden group-hover:-translate-y-3 transition-transform duration-500 delay-100">
                    <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CheckCircle2 className="w-12 h-12 text-text-secondary group-hover:text-success transition-colors relative z-10" />
                    <div className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_70%,rgba(var(--success),0.4)_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="absolute inset-[1px] bg-card rounded-[1.4rem] lg:rounded-[1.8rem] z-0" />
                  </div>
                  <div className="mt-5 bg-background border border-border/50 px-5 py-2 rounded-full shadow-sm text-sm font-bold text-text-primary">
                    Actionable Fix
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </section>

        {/* --- High-End Bento Grid for Features --- */}
        <section className="mb-32">
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
            {latestCapabilities.map((feature, idx) => (
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

        {/* --- Launch CTA (Massive Impact) --- */}
        <section className="mb-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative rounded-[3.5rem] border border-border/50 bg-card overflow-hidden p-12 sm:p-20 shadow-[0_20px_80px_-20px_rgba(var(--primary),0.4)] backdrop-blur-3xl text-center flex flex-col items-center justify-center"
          >
            {/* Massive inner gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-accent/10 opacity-50" />
            
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="tf-title text-4xl sm:text-6xl font-extrabold text-text-primary mb-6">Stop guessing. Start fixing.</h2>
              <p className="text-lg sm:text-xl text-text-secondary mb-10 leading-relaxed">
                Join engineering teams shipping faster, safer releases. Setup takes 3 minutes and requires no credit card.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center items-center gap-5">
                <Link href="/signup" className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-primary px-10 py-5 text-lg font-bold text-primary-foreground shadow-[0_0_40px_-10px_rgba(var(--primary),0.8)] transition-all hover:scale-105 hover:bg-primary-hover hover:shadow-[0_0_60px_-10px_rgba(var(--primary),1)] w-full sm:w-auto">
                  Create your workspace
                </Link>
                <Link href="/pricing" className="group inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/50 backdrop-blur px-10 py-5 text-lg font-bold text-text-primary transition-all hover:bg-secondary w-full sm:w-auto">
                  View pricing
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

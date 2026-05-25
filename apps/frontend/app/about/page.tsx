"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { MouseEvent, useRef, ReactNode } from "react";

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

const storyBlocks = [
  {
    title: "Why we built it",
    text: "Too many teams still bounce between logs, alerts, and chat threads before they can answer a simple question: what broke, who owns it, and what changed? We built TraceForge to remove that first layer of chaos."
  },
  {
    title: "How we built it",
    text: "We focused on the workflow after the exception lands: grouping noisy events, adding release context, generating AI guidance, connecting GitHub, Slack, and Jira, and making ownership visible across projects and organizations."
  },
  {
    title: "What success looks like",
    text: "Success is a quieter release day. The team sees the signal early, understands the likely cause, routes it quickly, opens the GitHub issue with context already attached, and resolves it before the incident becomes a customer story."
  }
];

const buildPrinciples = [
  "Clarity before dashboards",
  "AI that reduces toil",
  "Ownership that stays visible",
  "Reliability that feels collaborative",
  "Context that reaches code"
];

const milestones = [
  { label: "Capture", text: "Bring frontend, backend, and worker failures into one stream." },
  { label: "Understand", text: "Group duplicates, add release context, and surface the likely cause." },
  { label: "Coordinate", text: "Route through projects, alerts, members, and organizations." },
  { label: "Improve", text: "Learn from recurring issues and ship calmer releases next time." },
  { label: "Connect", text: "Route work to GitHub, Slack, and Jira without rebuilding incident context." }
];

function MagneticButton({ children, href, className }: { children: ReactNode, href: string, className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    x.set(middleX * 0.2); // Pull strength
    y.set(middleY * 0.2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div style={{ x: mouseXSpring, y: mouseYSpring }}>
      <Link 
        href={href}
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </Link>
    </motion.div>
  );
}

export default function AboutPage() {
  return (
    <main className="tf-page pb-24 pt-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none -z-10" />
      <motion.div 
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 -left-32 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none mix-blend-screen" 
      />

      <div className="tf-container relative z-10">
        
        {/* --- Hero Section --- */}
        <section className="grid gap-12 lg:gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center min-h-[50vh] mb-24 lg:mb-32">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.p variants={fadeUpVariant} className="tf-kicker mb-4">About TraceForge</motion.p>
            <motion.h1 variants={fadeUpVariant} className="tf-title text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tighter">
              We built TraceForge to make production issues <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">easier to understand.</span>
            </motion.h1>
            <motion.p variants={fadeUpVariant} className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary font-medium">
              TraceForge started with a simple frustration: teams were spending too much
              energy collecting context and not enough energy fixing the problem. We wanted
              one place where errors could arrive, get cleaned up, gain meaning, and move
              toward resolution.
            </motion.p>
            <motion.div variants={fadeUpVariant} className="mt-10 flex flex-wrap gap-4">
              <MagneticButton 
                href="/signup" 
                className="group inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-5px_rgba(var(--primary),0.5)] transition-all hover:bg-primary-hover"
              >
                Try TraceForge
              </MagneticButton>
              <MagneticButton 
                href="/blog" 
                className="group inline-flex items-center justify-center rounded-full border border-border bg-card/50 backdrop-blur px-8 py-4 text-sm font-semibold text-text-primary transition-all hover:bg-secondary"
              >
                Read our thinking
              </MagneticButton>
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 50, damping: 20, delay: 0.3 }}
            className="rounded-[2rem] border border-border/80 bg-gradient-to-br from-card/80 to-secondary/30 p-8 shadow-xl backdrop-blur-md"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-5">
              Our belief
            </p>
            <h2 className="text-2xl font-bold text-text-primary mb-8 leading-tight">
              Reliability should feel like momentum, not overhead.
            </h2>
            <div className="space-y-3">
              {buildPrinciples.map((item, i) => (
                <motion.div 
                  key={item} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + (i * 0.1) }}
                  className="flex items-center gap-4 rounded-[1rem] border border-border/50 bg-background/50 px-5 py-4 shadow-sm hover:bg-background transition-colors"
                >
                  <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-sm font-semibold text-text-primary">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* --- Story Blocks Bento Grid --- */}
        <section className="mb-24 lg:mb-32">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid gap-5 lg:grid-cols-3"
          >
            {storyBlocks.map((item) => (
              <motion.div key={item.title} variants={bentoVariant} className="group flex flex-col justify-between rounded-[1.5rem] border border-border/80 bg-card/60 backdrop-blur-md p-8 hover:-translate-y-1 hover:bg-card/90 transition-all duration-300 shadow-sm hover:shadow-lg">
                <div>
                  <h2 className="text-xl font-bold text-text-primary mb-4">{item.title}</h2>
                  <p className="text-sm leading-relaxed text-text-secondary">{item.text}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* --- Milestones Timeline --- */}
        <section className="mb-24 lg:mb-32 tf-frame rounded-[2.5rem] bg-secondary/30 backdrop-blur p-8 lg:p-14 border border-border/80 shadow-inner">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <p className="tf-kicker mb-4">Our story</p>
              <h2 className="tf-title text-3xl lg:text-4xl font-bold leading-tight">We designed the product around the real moment of stress.</h2>
              <p className="mt-6 text-base leading-relaxed text-text-secondary">
                The first few minutes after an incident matter the most. That is the point
                where teams either gather around one shared understanding or lose time
                reconstructing the same context in three different places. TraceForge is
                built to make that moment smaller, calmer, and easier to move through.
              </p>
            </motion.div>
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid gap-4 sm:grid-cols-2"
            >
              {milestones.map((item, index) => (
                <motion.div key={item.label} variants={bentoVariant} className="rounded-[1.5rem] border border-border/80 bg-background/80 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Step {index + 1}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-text-primary mb-2">{item.label}</p>
                  <p className="text-sm leading-relaxed text-text-secondary">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* --- Success Scenario CTA --- */}
        <section>
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 60, damping: 20 }}
            className="rounded-[2.5rem] border border-border/80 bg-gradient-to-r from-card to-accent-soft/30 p-8 sm:p-12 lg:p-14 shadow-2xl backdrop-blur-xl flex flex-col lg:flex-row items-center justify-between gap-10"
          >
            <div className="max-w-2xl relative z-10">
              <p className="tf-kicker mb-4">Success scenario</p>
              <h2 className="tf-title text-3xl sm:text-4xl font-bold text-text-primary mb-6 leading-tight">
                The best outcome is that the team feels in control.
              </h2>
              <p className="text-base sm:text-lg leading-relaxed text-text-secondary">
                A deploy goes out, error volume shifts, the issue is grouped instantly,
                the AI summary points to the likely regression, the alert reaches the right
                owner, the GitHub issue opens with context already attached, and the fix ships
                before the incident becomes a support escalation.
              </p>
            </div>
            <div className="relative z-10 shrink-0">
              <MagneticButton 
                href="/solutions"
                className="inline-flex items-center justify-center rounded-full border border-border bg-background px-8 py-4 text-sm font-bold text-text-primary transition-all hover:bg-secondary shadow-sm hover:shadow-md"
              >
                See how teams use it
              </MagneticButton>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

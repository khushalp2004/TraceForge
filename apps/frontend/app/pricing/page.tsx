"use client";

import { motion } from "framer-motion";
import { PricingPlans } from "./PricingPlans";

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

export default function PricingPage() {
  return (
    <main className="tf-page pb-24 pt-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none -z-10" />
      {/* Dynamic Background Elements */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none mix-blend-screen" 
      />

      <div className="tf-container relative z-10">
        <section className="text-center max-w-3xl mx-auto mb-20">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.p variants={fadeUpVariant} className="tf-kicker mb-4">Pricing</motion.p>
            <motion.h1 variants={fadeUpVariant} className="tf-title text-5xl sm:text-6xl font-bold leading-tight tracking-tighter">
              Simple pricing that <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">scales with you.</span>
            </motion.h1>
            <motion.p variants={fadeUpVariant} className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed font-medium">
              Start free, upgrade to Pro for personal unlimited AI, or choose Team for shared organization capacity.
            </motion.p>
          </motion.div>
        </section>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 50, damping: 20, delay: 0.3 }}
        >
          <PricingPlans />
        </motion.div>

        <section className="mt-24 lg:mt-32">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative rounded-[2rem] border border-border/80 bg-gradient-to-br from-card to-accent-soft/30 overflow-hidden p-8 sm:p-12 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-8"
          >
            {/* Ambient Glow inside CTA */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 max-w-2xl">
              <h2 className="tf-title text-3xl font-bold text-text-primary mb-3">Need a custom plan?</h2>
              <p className="text-base sm:text-lg text-text-secondary">
                We can tailor TraceForge for your compliance, security, and massive scale needs. Let's build a reliability program that fits perfectly.
              </p>
            </div>
            <div className="relative z-10 shrink-0">
              <a href="mailto:team@usetraceforge.com" className="inline-flex items-center justify-center rounded-full border border-border bg-background px-8 py-4 text-sm font-bold text-text-primary transition-all hover:bg-secondary hover:-translate-y-1 shadow-sm hover:shadow-md">
                Talk to Sales
              </a>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

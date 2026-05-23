"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { motion } from "framer-motion";
import { blogPosts } from "./posts";

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

export default function BlogPage() {
  return (
    <main className="tf-page pb-24 pt-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none -z-10" />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-10 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none mix-blend-screen" 
      />

      <div className="tf-container relative z-10">
        
        {/* --- Hero Section --- */}
        <section className="mb-20 lg:mb-28">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-3xl"
          >
            <motion.p variants={fadeUpVariant} className="tf-kicker mb-4">TraceForge Blog</motion.p>
            <motion.h1 variants={fadeUpVariant} className="tf-title text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tighter">
              Insights on reliability, AI, and <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">shipping faster.</span>
            </motion.h1>
            <motion.p variants={fadeUpVariant} className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed font-medium">
              Product thinking, engineering lessons, and the ideas shaping how we build
              calmer incident workflows.
            </motion.p>

            <motion.div variants={staggerContainer} className="mt-10 flex flex-wrap gap-3">
              {[
                "AI summaries + grouped issues",
                "GitHub issue creation + repo analysis",
                "Slack, Jira, and release workflows"
              ].map((item) => (
                <motion.div key={item} variants={fadeUpVariant} className="rounded-full border border-border/80 bg-card/60 backdrop-blur px-5 py-2 text-sm font-semibold text-text-secondary shadow-sm">
                  {item}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* --- Blog Post Grid --- */}
        <section className="mb-24 lg:mb-32">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid gap-6 lg:gap-8 lg:grid-cols-3"
          >
            {blogPosts.map((post) => (
              <motion.article 
                key={post.slug} 
                variants={bentoVariant} 
                className="group flex flex-col justify-between h-[360px] rounded-[1.5rem] border border-border/80 bg-card/60 backdrop-blur-md overflow-hidden shadow-sm hover:shadow-xl cursor-pointer relative"
              >
                {/* Background Hover Image Reveal (Mock Graphic) */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-0 scale-105 group-hover:scale-100 ease-out" />
                
                <div className="relative z-10 flex flex-col h-full p-8 transition-transform duration-500 group-hover:-translate-y-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-4">{post.date}</p>
                    <h2 className="text-xl font-bold text-text-primary mb-3 leading-tight group-hover:text-primary transition-colors">{post.title}</h2>
                    <p className="text-sm font-medium text-text-secondary mb-4">{post.summary}</p>
                    <p className="text-sm leading-relaxed text-text-secondary line-clamp-3 transition-opacity duration-300 group-hover:opacity-60">{post.description}</p>
                  </div>
                  
                  {/* Sliding Read Button */}
                  <div className="absolute bottom-6 left-8 right-8 pt-4 border-t border-border/50 flex items-center justify-between text-sm font-bold text-primary opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out">
                    Read article
                    <span className="transform translate-x-[-10px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 delay-100 ease-out">→</span>
                  </div>
                </div>
                <Link href={`/blog/${post.slug}`} className="absolute inset-0 z-20">
                  <span className="sr-only">Read {post.title}</span>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        </section>

        {/* --- Footer CTA --- */}
        <section>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative rounded-[2.5rem] border border-border/80 bg-gradient-to-tl from-card to-accent-soft/30 overflow-hidden p-8 sm:p-12 lg:p-14 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-10"
          >
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 max-w-2xl">
              <h2 className="tf-title text-3xl font-bold text-text-primary mb-4">Stay up to date.</h2>
              <p className="text-base sm:text-lg text-text-secondary">
                Explore product updates, release thinking, and reliability lessons from the TraceForge team.
              </p>
            </div>
            <div className="relative z-10 shrink-0">
              <Link className="inline-flex items-center justify-center rounded-full border border-border bg-background px-8 py-4 text-sm font-bold text-text-primary transition-all hover:bg-secondary hover:-translate-y-1 shadow-sm hover:shadow-md" href="/docs">
                Read docs
              </Link>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

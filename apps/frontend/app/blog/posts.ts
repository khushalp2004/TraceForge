export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  description: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "introducing-traceforge-ai-summaries",
    title: "Introducing TraceForge AI summaries",
    date: "Mar 10, 2026",
    summary: "Root-cause explanations that keep every team aligned.",
    description:
      "Why we added AI summaries to TraceForge, what they should do for teams, and why the product shows the short answer first before revealing deeper analysis.",
    sections: [
      {
        heading: "Why we built AI summaries",
        body: [
          "Teams do not need another long wall of text during an incident. They need the likely cause, the change that matters, and the next action to take. We added AI summaries to reduce the time between seeing an issue and understanding its shape.",
          "The goal was not to replace engineering judgment. It was to remove repetitive interpretation work so teams can spend more time fixing and less time reconstructing context."
        ]
      },
      {
        heading: "What a good summary looks like",
        body: [
          "In TraceForge, a useful AI summary starts with the shortest useful answer. It should tell the team what changed, what surface is affected, and where to look next.",
          "That is why we moved toward a summary-first experience with detail on demand. The product should feel calm at first glance and deeper only when the user asks for it."
        ]
      },
      {
        heading: "How it fits the workflow",
        body: [
          "AI summaries work best when they sit next to grouped issues, release context, and ownership. A clever explanation without routing is still incomplete.",
          "TraceForge pairs the summary with the issue inbox, release health, alerts, and GitHub issue creation so teams can move from understanding to action without switching tools."
        ]
      }
    ]
  },
  {
    slug: "reducing-alert-fatigue-with-better-grouping",
    title: "Reducing alert fatigue with better grouping",
    date: "Feb 28, 2026",
    summary: "How we cluster noisy stacks into actionable issues.",
    description:
      "A closer look at why duplicate stacks create alert fatigue, and how grouping creates a cleaner, more reliable issue workflow.",
    sections: [
      {
        heading: "The real problem with noisy alerts",
        body: [
          "Teams rarely fail because they saw too little data. They fail because the data arrived as a flood of almost-identical signals.",
          "When every event becomes its own decision, engineers stop trusting the feed. Grouping is the layer that turns repeated exceptions into one piece of work."
        ]
      },
      {
        heading: "Why grouping matters",
        body: [
          "A grouped issue lets a team see recurrence, severity, last seen time, and release impact in one place. That immediately changes prioritization.",
          "Instead of asking whether twenty errors are related, the team can start with one issue and one owner."
        ]
      },
      {
        heading: "What we optimized for",
        body: [
          "We wanted grouping to feel dependable, not magical. It should reduce noise without hiding meaningful differences.",
          "That is why TraceForge uses grouping as the center of the workflow: alerts, AI generation, archived issues, and recent events all hang off the issue rather than isolated raw events."
        ]
      }
    ]
  },
  {
    slug: "repo-analysis-for-faster-onboarding",
    title: "Repo analysis for faster onboarding",
    date: "Apr 6, 2026",
    summary: "GitHub repo analysis that explains structure before the first fix.",
    description:
      "Why we added repository analysis to TraceForge, what the report includes, and how it helps engineers move from a production issue to the right part of the codebase faster.",
    sections: [
      {
        heading: "Why repo analysis matters",
        body: [
          "An error report is only half the story if the engineer still needs to understand a codebase from scratch. That is especially true in shared platforms, inherited services, or onboarding moments.",
          "We added repo analysis so TraceForge can help teams answer the next question after triage: where does this system start, how is it organized, and what part of the repository should we read first?"
        ]
      },
      {
        heading: "What the report includes",
        body: [
          "The report summarizes the repository, describes the likely architecture, lists important modules, points to entry points, and calls out risks or coupling that deserve caution.",
          "It is designed to be practical rather than academic. The output should help an engineer orient faster, not generate another document that never gets used."
        ]
      },
      {
        heading: "How it fits TraceForge",
        body: [
          "Repo analysis sits naturally next to grouped issues, AI summaries, and GitHub issue creation. Teams can now move from the incident to the codebase with far less context rebuilding.",
          "That makes TraceForge more than an error inbox. It becomes the place where production context starts connecting back to implementation."
        ]
      }
    ]
  },
  {
    slug: "enterprise-readiness-checklist",
    title: "Enterprise readiness checklist",
    date: "Feb 12, 2026",
    summary: "Security and compliance practices that scale with your org.",
    description:
      "The practical product decisions that make an error intelligence platform feel ready for larger, regulated, or cross-functional organizations.",
    sections: [
      {
        heading: "Reliability tools need trust",
        body: [
          "As teams grow, incident tools stop being just an engineering concern. They become part of the operating system of the company.",
          "That means permissions, auditability, retention choices, and predictable ownership matter as much as the core debugging features."
        ]
      },
      {
        heading: "The baseline checklist",
        body: [
          "A product should support organizations, projects, role-based access, billing separation, and clean visibility into who can view or act on incidents.",
          "It should also make release health, alerts, and issue history easy to review later, not only during the live incident."
        ]
      },
      {
        heading: "What this means for TraceForge",
        body: [
          "We treat reliability as a collaborative system. That is why TraceForge keeps projects, organizations, alerts, releases, and AI workflows connected instead of building them as isolated pages.",
          "The result is a product that can start simple for a single engineer and still feel coherent when the team and the stakes grow."
        ]
      }
    ]
  }
];

export const getBlogPost = (slug: string) => blogPosts.find((post) => post.slug === slug) ?? null;

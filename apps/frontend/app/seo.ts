import type { Metadata } from "next";

export const SITE_NAME = "TraceForge";
export const SITE_DESCRIPTION =
  "TraceForge is an AI-powered error monitoring platform that groups runtime issues, adds root-cause guidance, and helps engineering teams resolve incidents faster.";
export const SITE_KEYWORDS = [
  "error monitoring",
  "AI error monitoring",
  "exception tracking",
  "incident management",
  "application monitoring",
  "release monitoring",
  "observability",
  "stack trace analysis",
  "developer tools"
];

export const siteUrl = (() => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
})();

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}

type SeoInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false
}: SeoInput): Metadata {
  const fullTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    keywords: [...SITE_KEYWORDS, ...keywords],
    alternates: {
      canonical: path
    },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: "/traceforge.png",
          width: 512,
          height: 512,
          alt: `${SITE_NAME} logo`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/traceforge.png"]
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
            nocache: true
          }
        }
      : {
          index: true,
          follow: true
        }
  };
}

export const PUBLIC_SITEMAP_ROUTES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/product", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/pricing", changeFrequency: "weekly" as const, priority: 0.85 },
  { path: "/solutions", changeFrequency: "weekly" as const, priority: 0.85 },
  { path: "/docs", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly" as const, priority: 0.75 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.4 }
];

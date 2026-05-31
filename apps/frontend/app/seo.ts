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
  image?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
  image = "/traceforge-logo.svg"
}: SeoInput): Metadata {
  const fullTitle = title === SITE_NAME ? SITE_NAME : `${SITE_NAME} | ${title}`;
  const url = absoluteUrl(path);

  return {
    title: { absolute: fullTitle },
    description,
    keywords: Array.from(new Set([...SITE_KEYWORDS, ...keywords])),
    alternates: {
      canonical: url
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${fullTitle} - ${SITE_NAME}`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
      creator: "@traceforge"
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
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1
          }
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
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.4 },
  { path: "/security", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/help", changeFrequency: "monthly" as const, priority: 0.55 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.45 }
];

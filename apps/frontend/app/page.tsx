import type { Metadata } from "next";
import { absoluteUrl, createPageMetadata, SITE_NAME } from "./seo";
import HomePageClient from "./HomePageClientV2";

export const metadata: Metadata = createPageMetadata({
  title: SITE_NAME,
  description:
    "Turn stack traces into clear fixes with AI-powered error monitoring, issue grouping, and faster incident response for engineering teams.",
  path: "/",
  keywords: ["stack trace analysis", "incident response", "developer observability"]
});

export default function HomePage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/traceforge-logo.svg")
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "AI-powered error monitoring for engineering teams, with issue grouping, release context, alerts, and remediation guidance.",
      url: absoluteUrl("/"),
      image: absoluteUrl("/traceforge-logo.svg")
    }
  ];

  return (
    <>
      {structuredData.map((item, index) => (
        <script
          key={`seo-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <HomePageClient />
    </>
  );
}

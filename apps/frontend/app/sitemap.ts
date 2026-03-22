import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_ROUTES, absoluteUrl } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}

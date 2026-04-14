import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "./seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f0",
    theme_color: "#f59e0b",
    icons: [
      {
        src: "/traceforge-logo.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}

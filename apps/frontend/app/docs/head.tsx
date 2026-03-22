import { SITE_NAME, absoluteUrl } from "../seo";

const title = `Docs | ${SITE_NAME}`;
const description =
  "Read the TraceForge developer docs to install the SDK, send errors, tag releases, and connect alerts with issue triage.";
const canonical = absoluteUrl("/docs");
const image = absoluteUrl("/traceforge.png");

export default function Head() {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="TraceForge docs, error monitoring docs, SDK setup, release tagging" />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="robots" content="index,follow" />
    </>
  );
}

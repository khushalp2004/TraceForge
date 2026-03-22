import { SITE_NAME, absoluteUrl } from "../seo";

const title = `Verify Email | ${SITE_NAME}`;
const description = "Verify your email to finish accessing your TraceForge workspace.";
const canonical = absoluteUrl("/verify");

export default function Head() {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content="noindex,nofollow" />
    </>
  );
}

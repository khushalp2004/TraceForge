import { SITE_NAME, absoluteUrl } from "../seo";

const title = `Reset Password | ${SITE_NAME}`;
const description = "Reset your TraceForge account password.";
const canonical = absoluteUrl("/reset");

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

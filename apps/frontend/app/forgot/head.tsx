import { SITE_NAME, absoluteUrl } from "../seo";

const title = `Forgot Password | ${SITE_NAME}`;
const description = "Recover access to your TraceForge account.";
const canonical = absoluteUrl("/forgot");

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

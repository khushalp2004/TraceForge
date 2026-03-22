import type { Metadata } from "next";
import AuthScreen from "../components/AuthScreen";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Sign In",
  description: "Sign in to your TraceForge workspace.",
  path: "/signin",
  noIndex: true
});

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}

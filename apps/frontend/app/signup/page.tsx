import type { Metadata } from "next";
import AuthScreen from "../components/AuthScreen";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Sign Up",
  description: "Create a TraceForge account and start monitoring errors.",
  path: "/signup",
  noIndex: true
});

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}

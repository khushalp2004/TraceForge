import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import SiteHeader from "./components/SiteHeader";

export const metadata: Metadata = {
  title: "TraceForge",
  description: "AI-powered error monitoring",
  icons: {
    icon: "/traceforge.png",
    shortcut: "/traceforge.png",
    apple: "/traceforge.png"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
        <SiteHeader />
        {children}
        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-[30px] py-6 text-xs text-text-secondary">
            <p>
              TraceForge ·{" "}
              <span className="font-semibold text-text-secondary">Forged for calm production.</span>
            </p>
            <div className="flex items-center gap-4">
              <a className="tf-navlink" href="/docs">
                Documentation
              </a>
              <a className="tf-navlink" href="/dashboard">
                Status
              </a>
              <a className="tf-navlink" href="/forgot-password">
                Support
              </a>
            </div>
          </div>
        </footer>
      </AuthProvider>
      </body>
    </html>
  );
}

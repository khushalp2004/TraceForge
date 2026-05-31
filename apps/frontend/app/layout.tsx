import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { LayoutProvider } from "../context/LayoutContext";
import { ThemeProvider } from "../context/ThemeContext";
import { GlobalSearchProvider } from "./components/GlobalSearchProvider";
import MarketingShell from "./components/MarketingShell";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, siteUrl } from "./seo";
import { DEFAULT_THEME, isDarkTheme, THEME_STORAGE_KEY } from "./theme";
import { DEFAULT_LAYOUT, LAYOUT_STORAGE_KEY } from "./layoutPreference";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `${SITE_NAME} | %s`
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  category: "technology",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  authors: [{ name: SITE_NAME, url: siteUrl }],
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/"
    }
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/traceforge-logo.svg",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - AI-powered error monitoring`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/traceforge-logo.svg"],
    creator: "@traceforge",
    site: "@traceforge"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/traceforge-logo.svg", type: "image/svg+xml" }
    ],
    shortcut: "/traceforge-logo.svg",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f59e0b"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const defaultThemeIsDark = isDarkTheme(DEFAULT_THEME);
  const defaultLayout = DEFAULT_LAYOUT;
  const themeBootScript = `
    (function () {
      try {
        var key = ${JSON.stringify(THEME_STORAGE_KEY)};
        var fallback = ${JSON.stringify(DEFAULT_THEME)};
        var stored = window.localStorage.getItem(key);
        var allowed = ["trace-light", "linen-light", "sage-light", "graphite-dark", "midnight-dark", "plum-dark"];
        var theme = allowed.indexOf(stored) >= 0 ? stored : fallback;
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.toggle("dark", theme === "graphite-dark" || theme === "midnight-dark" || theme === "plum-dark");
      } catch (error) {
        document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
        document.documentElement.classList.toggle("dark", ${defaultThemeIsDark ? "true" : "false"});
      }
    })();
  `;

  const layoutBootScript = `
    (function () {
      try {
        var key = ${JSON.stringify(LAYOUT_STORAGE_KEY)};
        var fallback = ${JSON.stringify(defaultLayout)};
        var stored = window.localStorage.getItem(key);
        var allowed = ["classic", "compact", "topbar"];
        var layout = allowed.indexOf(stored) >= 0 ? stored : fallback;
        document.documentElement.dataset.layout = layout;
      } catch (error) {
        document.documentElement.dataset.layout = ${JSON.stringify(defaultLayout)};
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: layoutBootScript }} />
        <ThemeProvider>
          <LayoutProvider>
            <AuthProvider>
              <GlobalSearchProvider>
                <MarketingShell>{children}</MarketingShell>
              </GlobalSearchProvider>
            </AuthProvider>
          </LayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

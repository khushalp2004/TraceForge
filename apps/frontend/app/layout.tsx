import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { LayoutProvider } from "../context/LayoutContext";
import { ThemeProvider } from "../context/ThemeContext";
import { GlobalSearchProvider } from "./components/GlobalSearchProvider";
import MarketingShell from "./components/MarketingShell";
import TraceForgeBrowserInit from "./components/TraceForgeBrowserInit";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, siteUrl } from "./seo";
import { DEFAULT_THEME, isDarkTheme, THEME_STORAGE_KEY } from "./theme";
import { DEFAULT_LAYOUT, LAYOUT_STORAGE_KEY } from "./layoutPreference";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  category: "technology",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  referrer: "origin-when-cross-origin",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: "/traceforge.png",
        width: 512,
        height: 512,
        alt: `${SITE_NAME} logo`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/traceforge.png"]
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: "/traceforge.png",
    shortcut: "/traceforge.png",
    apple: "/traceforge.png"
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: layoutBootScript }} />
        <ThemeProvider>
          <TraceForgeBrowserInit />
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

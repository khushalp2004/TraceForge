import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata = {
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
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/traceforge.png"
                alt="TraceForge logo"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
              <div>
                <p className="text-sm font-semibold text-ink">TraceForge</p>
                <p className="text-xs text-slate-500">Enterprise observability</p>
              </div>
            </Link>
            <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-600 lg:flex">
              <Link className="transition hover:text-blue-700" href="/product">
                Product
              </Link>
              <Link className="transition hover:text-blue-700" href="/pricing">
                Pricing
              </Link>
              <Link className="transition hover:text-blue-700" href="/solutions">
                Solutions
              </Link>
              <Link className="transition hover:text-blue-700" href="/docs">
                Docs
              </Link>
              <Link className="transition hover:text-blue-700" href="/about">
                About
              </Link>
              <Link className="transition hover:text-blue-700" href="/blog">
                Blog
              </Link>
            </nav>
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <button className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:bg-slate-50 lg:inline-flex">
                Search
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                  /
                </span>
              </button>
              <Link className="transition hover:text-blue-700" href="/dashboard">
                Login
              </Link>
              <Link
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                href="/dashboard"
              >
                Get Started Free
              </Link>
            </div>
          </div>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 text-xs font-semibold text-slate-500 lg:hidden">
            <Link className="transition hover:text-blue-700" href="/product">
              Product
            </Link>
            <Link className="transition hover:text-blue-700" href="/pricing">
              Pricing
            </Link>
            <Link className="transition hover:text-blue-700" href="/solutions">
              Solutions
            </Link>
            <Link className="transition hover:text-blue-700" href="/docs">
              Docs
            </Link>
            <Link className="transition hover:text-blue-700" href="/about">
              About
            </Link>
            <Link className="transition hover:text-blue-700" href="/blog">
              Blog
            </Link>
          </div>
        </header>
        {children}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-slate-500">
            <p>TraceForge · Built for enterprise-grade reliability.</p>
            <div className="flex items-center gap-4">
              <Link className="transition hover:text-blue-700" href="/docs">
                Documentation
              </Link>
              <Link className="transition hover:text-blue-700" href="/dashboard">
                Status
              </Link>
              <Link className="transition hover:text-blue-700" href="/forgot-password">
                Support
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

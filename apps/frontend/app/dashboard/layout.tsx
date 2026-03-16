import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50/70">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white/90 p-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/traceforge.png"
            alt="TraceForge logo"
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
          />
          <div>
            <p className="text-sm font-semibold text-ink">TraceForge</p>
            <p className="text-xs text-slate-500">Enterprise workspace</p>
          </div>
        </Link>

        <div className="mt-8 space-y-2 text-sm font-semibold text-slate-600">
          <Link className="block rounded-xl px-3 py-2 transition hover:bg-blue-50" href="/dashboard">
            Overview
          </Link>
          <Link
            className="block rounded-xl px-3 py-2 transition hover:bg-blue-50"
            href="/dashboard/projects"
          >
            Projects
          </Link>
          <Link
            className="block rounded-xl px-3 py-2 transition hover:bg-blue-50"
            href="/dashboard/orgs"
          >
            Team Members
          </Link>
          <Link className="block rounded-xl px-3 py-2 transition hover:bg-blue-50" href="/docs">
            Docs
          </Link>
        </div>

        <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-semibold text-blue-700">Need help?</p>
          <p className="mt-2">
            Explore quickstart guides or reach out to support for onboarding help.
          </p>
          <Link className="mt-3 inline-flex text-xs font-semibold text-blue-700" href="/docs">
            Visit documentation →
          </Link>
        </div>
      </aside>

      <div className="flex-1">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
            <Link href="/dashboard" className="flex items-center gap-2 text-ink">
              <Image
                src="/traceforge.png"
                alt="TraceForge logo"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              Dashboard
            </Link>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <Link className="transition hover:text-blue-700" href="/dashboard/projects">
                Projects
              </Link>
              <Link className="transition hover:text-blue-700" href="/dashboard/orgs">
                Team
              </Link>
              <Link className="transition hover:text-blue-700" href="/docs">
                Docs
              </Link>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

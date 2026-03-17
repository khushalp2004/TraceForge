import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="tf-page pb-20 pt-16">
      <div className="relative mx-auto max-w-6xl px-[16px]">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="tf-kicker">About</p>
            <h1 className="tf-title mt-4 text-3xl sm:text-4xl lg:text-5xl">
              Building the error intelligence platform for modern teams.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-text-secondary">
              TraceForge exists to help teams ship faster without compromising reliability.
              We believe operational excellence should be accessible, automated, and
              collaborative.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="tf-button px-6 py-3 text-sm" href="/dashboard">
                View Platform
              </Link>
              <Link className="tf-button-ghost px-6 py-3 text-sm" href="/blog">
                Read the Blog
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card/90 p-5 sm:p-6 shadow-lg">
            <div className="rounded-2xl border border-border bg-secondary/70 p-5 sm:p-6">
              <p className="text-xs font-semibold text-text-secondary">Our principles</p>
              <div className="mt-4 space-y-3 text-sm text-text-secondary">
                <p>• Reliability is a product feature</p>
                <p>• AI should reduce toil, not add complexity</p>
                <p>• Security and trust are non-negotiable</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Mission",
              text: "Make error intelligence accessible to every engineering team."
            },
            {
              title: "Values",
              text: "Clarity, speed, and trust in every product decision."
            },
            {
              title: "Customers",
              text: "Teams building payments, healthcare, and infrastructure."
            }
          ].map((item) => (
            <div key={item.title} className="tf-card p-6">
              <h3 className="tf-section-title">{item.title}</h3>
              <p className="mt-3 text-sm text-text-secondary">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 tf-frame">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="tf-kicker">Careers</p>
              <h2 className="tf-title mt-4 text-2xl sm:text-3xl">
                Join us in shaping the future of reliability.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary">
                We are a remote-first team building tools for resilient software teams.
              </p>
            </div>
            <Link className="tf-button-ghost px-6 py-3 text-sm" href="/dashboard">
              View Open Roles
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

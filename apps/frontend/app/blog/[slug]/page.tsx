import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPageMetadata } from "../../seo";
import { blogPosts, getBlogPost } from "../posts";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return createPageMetadata({
      title: "Blog",
      description: "TraceForge blog articles on reliability, debugging, and incident response.",
      path: "/blog"
    });
  }

  return createPageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    keywords: ["TraceForge blog", post.title, "reliability engineering"]
  });
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-4xl">
        <div className="mb-6">
          <Link className="tf-link inline-flex text-sm" href="/blog">
            ← Back to blog
          </Link>
        </div>

        <article className="rounded-[2rem] border border-border bg-card/95 p-6 shadow-sm sm:p-8">
          <p className="tf-kicker">Blog</p>
          <p className="mt-4 text-xs font-semibold text-text-secondary">{post.date}</p>
          <h1 className="tf-title mt-3 text-3xl sm:text-4xl">{post.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-text-secondary sm:text-lg">
            {post.description}
          </p>

          <div className="mt-10 space-y-10">
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-semibold text-text-primary">{section.heading}</h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 text-text-secondary sm:text-base">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}

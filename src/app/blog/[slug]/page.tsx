import { notFound } from "next/navigation";

import { getPublishedBlogBySlug } from "@/server/blogs";

export default async function BlogSlugPage({ params }: { params: { slug: string } }) {
  const post = await getPublishedBlogBySlug(params.slug);
  if (!post) return notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Blog</p>
          <h1 className="text-3xl font-semibold">{post.title}</h1>
          <p className="text-sm text-slate-500">
            {new Date(post.createdAt).toLocaleDateString()} • {post.authorEmail}
          </p>
        </div>
        {post.excerpt && <p className="text-base text-slate-600">{post.excerpt}</p>}
        <article className="prose prose-slate max-w-none">
          {post.content.split("\n").map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </article>
      </div>
    </main>
  );
}

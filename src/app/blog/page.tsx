import Link from "next/link";

import { listPublishedBlogs } from "@/server/blogs";

export default async function BlogListPage() {
  const posts = await listPublishedBlogs();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Insights</p>
          <h1 className="text-3xl font-semibold">NRI Law Buddy Blog</h1>
          <p className="text-slate-600">Guides, product updates, and legal ops playbooks.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-amber-600">Featured</p>
              <h2 className="mt-2 text-xl font-semibold group-hover:text-slate-900">{post.title}</h2>
              {post.excerpt && <p className="mt-2 text-sm text-slate-600">{post.excerpt}</p>}
              <p className="mt-3 text-xs text-slate-500">
                {new Date(post.createdAt).toLocaleDateString()} • {post.authorEmail}
              </p>
            </Link>
          ))}
          {posts.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-slate-500">
              No posts yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

import { NextResponse } from "next/server";

import { authorize } from "@/server/route-auth";
import { checkRole } from "@/server/guards";
import { listAllBlogs, upsertBlog } from "@/server/blogs";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const blogs = await listAllBlogs();
  return NextResponse.json({ blogs });
}

export async function POST(req: Request) {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    published?: boolean;
  } | null;

  if (!body?.title || !body?.content) {
    return NextResponse.json({ message: "Missing title or content" }, { status: 400 });
  }

  const saved = await upsertBlog({
    id: body.id,
    title: body.title,
    slug: body.slug,
    excerpt: body.excerpt,
    content: body.content,
    authorEmail: auth.session!.effectiveEmail,
    published: body.published ?? false,
  });

  return NextResponse.json({ blog: saved });
}

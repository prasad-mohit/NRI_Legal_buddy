import { NextResponse } from "next/server";

import { getPublishedBlogBySlug } from "@/server/blogs";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const post = await getPublishedBlogBySlug(params.slug);
  if (!post) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ blog: post });
}

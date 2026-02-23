import { NextResponse } from "next/server";

import { listPublishedBlogs } from "@/server/blogs";

export async function GET() {
  const blogs = await listPublishedBlogs();
  return NextResponse.json({ blogs });
}

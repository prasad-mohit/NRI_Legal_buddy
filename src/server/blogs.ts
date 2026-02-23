import { randomUUID } from "crypto";

import prisma from "@/server/db";
import { ensureRuntimeSchema } from "@/server/runtime-schema";
import { normalizeEmail } from "@/server/auth";

export type BlogRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  authorEmail: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

const toRecord = (row: any): BlogRecord => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt,
  content: row.content,
  authorEmail: row.authorEmail,
  published: Boolean(row.published),
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
});

export const listPublishedBlogs = async () => {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      content: string;
      authorEmail: string;
      published: number;
      createdAt: string;
      updatedAt: string;
    }>
  >`
    SELECT id, slug, title, excerpt, content, authorEmail, published, createdAt, updatedAt
    FROM Blog
    WHERE published = 1
    ORDER BY createdAt DESC
  `;
  return rows.map(toRecord);
};

export const listAllBlogs = async () => {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      content: string;
      authorEmail: string;
      published: number;
      createdAt: string;
      updatedAt: string;
    }>
  >`
    SELECT id, slug, title, excerpt, content, authorEmail, published, createdAt, updatedAt
    FROM Blog
    ORDER BY createdAt DESC
  `;
  return rows.map(toRecord);
};

export const getPublishedBlogBySlug = async (slug: string) => {
  await ensureRuntimeSchema();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      content: string;
      authorEmail: string;
      published: number;
      createdAt: string;
      updatedAt: string;
    }>
  >`
    SELECT id, slug, title, excerpt, content, authorEmail, published, createdAt, updatedAt
    FROM Blog
    WHERE slug = ${slug} AND published = 1
    LIMIT 1
  `;
  return rows[0] ? toRecord(rows[0]) : null;
};

export const upsertBlog = async (payload: {
  id?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  authorEmail: string;
  published?: boolean;
}) => {
  await ensureRuntimeSchema();
  const id = payload.id ?? `BLOG-${randomUUID()}`;
  const slug =
    payload.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ||
    payload.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const published = payload.published ? 1 : 0;

  await prisma.$executeRaw`
    INSERT INTO Blog (id, slug, title, excerpt, content, authorEmail, published, createdAt, updatedAt)
    VALUES (
      ${id},
      ${slug},
      ${payload.title},
      ${payload.excerpt ?? null},
      ${payload.content},
      ${normalizeEmail(payload.authorEmail)},
      ${published},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      authorEmail = excluded.authorEmail,
      published = excluded.published,
      updatedAt = CURRENT_TIMESTAMP
  `;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      content: string;
      authorEmail: string;
      published: number;
      createdAt: string;
      updatedAt: string;
    }>
  >`
    SELECT id, slug, title, excerpt, content, authorEmail, published, createdAt, updatedAt
    FROM Blog
    WHERE slug = ${slug}
    LIMIT 1
  `;

  return rows[0] ? toRecord(rows[0]) : null;
};

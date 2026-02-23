import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  console.log("[debug][api/admin/sessions] auth", auth.session);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;

  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subjectEmail: true,
      role: true,
      expiresAt: true,
      revokedAt: true,
      actingAsEmail: true,
      actingAsRole: true,
      createdAt: true,
    },
  });

  const now = Date.now();
  const active = sessions.filter(
    (s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now
  );

  return NextResponse.json({
    activeCount: active.length,
    totalCount: sessions.length,
    sessions,
  });
}

export async function POST(req: Request) {
  const auth = await authorize(["admin", "super-admin"]);
  console.log("[debug][api/admin/sessions] auth", auth.session);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const body = (await req.json().catch(() => null)) as { sessionId?: string; action?: string } | null;
  if (!body?.sessionId || body.action !== "revoke") {
    return NextResponse.json({ message: "Missing sessionId or action" }, { status: 400 });
  }

  await prisma.session.updateMany({
    where: { id: body.sessionId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ revoked: body.sessionId });
}

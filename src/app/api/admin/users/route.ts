import { NextResponse } from "next/server";

import { createAdminUser, listAdminUsers } from "@/server/admin";
import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const auth = await authorize(["super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const body = (await req.json()) as {
    email: string;
    displayName: string;
    role: string;
    password: string;
  };

  if (!body.email || !body.password || !body.displayName || !body.role) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  const user = await createAdminUser(body);
  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });
}

export async function PATCH(req: Request) {
  const auth = await authorize(["super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const body = (await req.json()) as {
    email: string;
    role: "client" | "lawyer" | "admin";
  };
  if (!body.email || !body.role) {
    return NextResponse.json({ message: "Missing email or role" }, { status: 400 });
  }

  await ensureRuntimeSchema();
  if (body.role === "admin") {
    await prisma.$executeRaw`
      INSERT INTO AdminUser (id, email, displayName, role, passwordHash, createdAt)
      VALUES (${`ADMIN-${Date.now()}`}, ${body.email.toLowerCase()}, ${body.email.split("@")[0]}, ${"admin"}, ${"reset-required"}, CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET role = ${"admin"}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE User
      SET role = ${body.role}
      WHERE email = ${body.email.toLowerCase()}
    `;
  }

  return NextResponse.json({ ok: true });
}

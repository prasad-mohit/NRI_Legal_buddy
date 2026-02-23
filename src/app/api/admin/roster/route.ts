import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

export async function GET() {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  await ensureRuntimeSchema();
  const managers = await prisma.$queryRaw<
    Array<{ id: string; name: string; timezone: string; specialization: string; weeklyLoad: number }>
  >`
    SELECT id, name, timezone, specialization, weeklyLoad
    FROM CaseManager
    ORDER BY name ASC
  `;

  const practitioners = await prisma.$queryRaw<
    Array<{ id: string; name: string; bar: string; focus: string }>
  >`
    SELECT id, name, bar, focus
    FROM Practitioner
    ORDER BY name ASC
  `;

  return NextResponse.json({ managers, practitioners });
}

export async function POST(req: Request) {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  await ensureRuntimeSchema();
  const body = (await req.json()) as {
    managers?: Array<{ id: string; name: string; timezone: string; specialization: string; weeklyLoad: number }>;
    practitioners?: Array<{ id: string; name: string; bar: string; focus: string }>;
  };

  const managerRows = body.managers ?? [];
  const practitionerRows = body.practitioners ?? [];

  for (const manager of managerRows) {
    await prisma.$executeRaw`
      INSERT INTO CaseManager (id, name, timezone, specialization, weeklyLoad)
      VALUES (${manager.id}, ${manager.name}, ${manager.timezone}, ${manager.specialization}, ${manager.weeklyLoad})
      ON CONFLICT(id) DO UPDATE SET
        name = ${manager.name},
        timezone = ${manager.timezone},
        specialization = ${manager.specialization},
        weeklyLoad = ${manager.weeklyLoad}
    `;
  }

  for (const practitioner of practitionerRows) {
    await prisma.$executeRaw`
      INSERT INTO Practitioner (id, name, bar, focus)
      VALUES (${practitioner.id}, ${practitioner.name}, ${practitioner.bar}, ${practitioner.focus})
      ON CONFLICT(id) DO UPDATE SET
        name = ${practitioner.name},
        bar = ${practitioner.bar},
        focus = ${practitioner.focus}
    `;
  }

  return NextResponse.json({ inserted: managerRows.length + practitionerRows.length });
}

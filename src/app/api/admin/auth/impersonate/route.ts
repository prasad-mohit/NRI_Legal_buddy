import { NextResponse } from "next/server";

import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";
import { impersonateSession } from "@/server/session";

export async function POST(req: Request) {
  const auth = await authorize(["super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;
  const body = (await req.json()) as { role: string; email: string };
  if (!body.role || !body.email) {
    return NextResponse.json({ message: "Missing role or email" }, { status: 400 });
  }
  await impersonateSession({ role: body.role, email: body.email.toLowerCase() });
  return NextResponse.json({ ok: true });
}

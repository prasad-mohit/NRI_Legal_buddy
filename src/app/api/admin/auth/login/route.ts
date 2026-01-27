import { NextResponse } from "next/server";

import { verifyAdminLogin } from "@/server/admin";

export async function POST(req: Request) {
  const body = (await req.json()) as { email: string; password: string };

  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  }

  const session = await verifyAdminLogin(body.email, body.password);
  if (!session) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  return NextResponse.json({ session });
}

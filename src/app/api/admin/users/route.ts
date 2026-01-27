import { NextResponse } from "next/server";

import { createAdminUser, listAdminUsers } from "@/server/admin";

export async function GET() {
  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
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

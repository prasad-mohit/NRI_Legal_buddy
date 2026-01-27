import { NextResponse } from "next/server";

import { verifyAdminLogin } from "@/server/admin";
import { verifyUserLogin } from "@/server/users";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    email: string;
    password: string;
    fullName: string;
    country: string;
  };

  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  }

  const adminSession = await verifyAdminLogin(body.email, body.password);
  if (adminSession) {
    return NextResponse.json({
      user: {
        fullName: adminSession.displayName,
        email: adminSession.email,
        country: "Administrator",
        role: "admin",
      },
    });
  }

  const user = await verifyUserLogin(body.email, body.password);
  if (!user) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  return NextResponse.json({ user });
}

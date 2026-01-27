import { NextResponse } from "next/server";

import { createUser, findUserByEmail } from "@/server/users";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    email: string;
    password: string;
    fullName: string;
    country: string;
  };

  if (!body.email || !body.password || !body.fullName || !body.country) {
    return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  }

  const existing = await findUserByEmail(body.email);
  if (existing) {
    return NextResponse.json({ message: "Account already exists" }, { status: 409 });
  }

  const created = await createUser({
    fullName: body.fullName,
    email: body.email,
    country: body.country,
    password: body.password,
  });

  return NextResponse.json({
    user: {
      fullName: created.fullName,
      email: created.email,
      country: created.country,
      role: "client",
    },
  });
}

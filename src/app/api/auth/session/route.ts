import { NextResponse } from "next/server";

import { findAdminByEmail } from "@/server/admin";
import { getSession } from "@/server/session";
import { findUserPublicByEmail } from "@/server/users";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const role = session.actingAsRole ?? session.role;
  const email = session.actingAsEmail ?? session.email;

  if (role === "admin" || role === "super-admin") {
    const admin = await findAdminByEmail(email);
    if (!admin) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({
      user: {
        fullName: admin.displayName,
        email: admin.email,
        country: "Administrator",
        role: admin.role,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    });
  }

  const user = await findUserPublicByEmail(email);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      fullName: user.fullName,
      email: user.email,
      country: user.country,
      role,
      signupFeePaid: user.signupFeePaid ?? false,
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  });
}

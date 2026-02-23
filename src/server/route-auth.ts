import { NextResponse } from "next/server";

import { requireRole } from "@/server/session";

export const unauthorized = () =>
  NextResponse.json({ message: "Unauthorized" }, { status: 401 });

export const authorize = async (roles: string[]) => {
  const session = await requireRole(roles);
  console.log("[debug][authorize]", { roles, session });
  if (!session) {
    return { session: null, response: unauthorized() };
  }
  return { session, response: null };
};

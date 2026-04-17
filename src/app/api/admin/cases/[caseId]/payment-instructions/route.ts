import { NextResponse } from "next/server";

import prisma from "@/server/db";
import { checkRole } from "@/server/guards";
import { authorize } from "@/server/route-auth";
import { getCase } from "@/server/storage";

export async function POST(
  req: Request,
  { params }: { params: { caseId: string } }
) {
  const auth = await authorize(["admin", "super-admin"]);
  if (auth.response) return auth.response;
  const roleGuard = checkRole(auth.session?.effectiveRole?.toUpperCase(), ["ADMIN", "SUPER-ADMIN"]);
  if (roleGuard) return roleGuard;

  const body = (await req.json()) as {
    bankInstructions?: string;
    paymentPlan?: string;
    terms?: string;
  };

  const exists = await prisma.case.findUnique({ where: { id: params.caseId }, select: { id: true } });
  if (!exists) return NextResponse.json({ message: "Case not found" }, { status: 404 });

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      ...(body.bankInstructions !== undefined ? { bankInstructions: body.bankInstructions } : {}),
      ...(body.paymentPlan !== undefined ? { paymentPlan: body.paymentPlan } : {}),
      ...(body.terms !== undefined ? { terms: body.terms } : {}),
    },
  });

  const record = await getCase(params.caseId);
  return NextResponse.json({ case: record });
}

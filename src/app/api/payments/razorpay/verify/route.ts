import { NextResponse } from "next/server";

import { writeAuditLog } from "@/server/audit-log";
import { verifyRazorpayPaymentSignature } from "@/server/payments";
import prisma from "@/server/db";
import { checkCaseState } from "@/server/guards";
import { getRequestIpAddress } from "@/server/request-meta";
import { consumeRateLimit } from "@/server/rate-limit";
import { authorize } from "@/server/route-auth";
import { ensureRuntimeSchema } from "@/server/runtime-schema";

const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_BLOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await authorize(["client", "admin", "super-admin"]);
  if (auth.response) return auth.response;

  let body: {
    caseId?: string;
    orderId?: string;
    paymentId?: string;
    signature?: string;
  };
  try {
    body = (await req.json()) as {
      caseId?: string;
      orderId?: string;
      paymentId?: string;
      signature?: string;
    };
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const caseId = (body.caseId ?? "").trim();
  const orderId = (body.orderId ?? "").trim();
  const paymentId = (body.paymentId ?? "").trim();
  const signature = (body.signature ?? "").trim();

  if (!caseId || !orderId || !paymentId || !signature) {
    return NextResponse.json({ message: "Missing payment verification fields" }, { status: 400 });
  }

  const caseState = await checkCaseState(caseId, [
    "SUBMITTED",
    "UNDER_REVIEW",
    "AWAITING_CLIENT_APPROVAL",
    "PAYMENT_PENDING",
    "IN_PROGRESS",
    "CLOSED",
  ]);
  if (caseState.response) return caseState.response;
  const caseRecord = caseState.record!;

  if (
    auth.session!.effectiveRole === "client" &&
    caseRecord.user.email !== auth.session!.effectiveEmail
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const ipLimit = await consumeRateLimit({
    bucket: "payments-verify-ip",
    subject: getRequestIpAddress(req),
    maxAttempts: 40,
    windowMs: VERIFY_WINDOW_MS,
    blockMs: VERIFY_BLOCK_MS,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many payment verification attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  const userLimit = await consumeRateLimit({
    bucket: "payments-verify-user",
    subject: `${auth.session!.effectiveEmail}|${caseId}`,
    maxAttempts: 15,
    windowMs: VERIFY_WINDOW_MS,
    blockMs: VERIFY_BLOCK_MS,
  });
  if (!userLimit.allowed) {
    return NextResponse.json(
      { message: "Too many payment verification attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(userLimit.retryAfterSeconds) },
      }
    );
  }

  const verified = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  await writeAuditLog({
    actorEmail: auth.session!.effectiveEmail,
    actorRole: auth.session!.effectiveRole,
    action: verified ? "payment.signature_verified" : "payment.signature_verification_failed",
    targetType: "case",
    targetId: caseId,
    details: {
      orderId,
      paymentId,
      paymentStatus: caseRecord.paymentStatus,
    },
  });

  if (!verified) {
    return NextResponse.json({ message: "Invalid payment signature" }, { status: 400 });
  }

  await ensureRuntimeSchema();
  await prisma.$executeRaw`
    UPDATE User
    SET signupFeePaid = 1
    WHERE email = ${caseRecord.user.email.toLowerCase()}
  `;

  return NextResponse.json({
    verified: true,
    caseId,
    paymentStatus: caseRecord.paymentStatus,
    requiresAdminApproval: caseRecord.paymentStatus !== "approved",
  });
}

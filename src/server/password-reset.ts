import { findAdminByEmail, updateAdminPasswordHashByEmail } from "@/server/admin";
import { isValidEmailFormat, normalizeEmail, validatePasswordStrength } from "@/server/auth";
import { logAuthEvent } from "@/server/logger";
import { consumePasswordResetOtp, createPasswordResetOtp } from "@/server/otp";
import { revokeSessionsByEmail } from "@/server/session";
import { sendOtpEmail } from "@/server/mailer";
import { findUserByEmail, updateUserPasswordHashByEmail } from "@/server/users";

export const requestPasswordReset = async (payload: {
  email: string;
  newPassword: string;
}) => {
  const email = normalizeEmail(payload.email);
  if (!isValidEmailFormat(email)) {
    return { ok: false as const, status: 400, message: "Invalid email address" };
  }

  const passwordCheck = validatePasswordStrength(payload.newPassword);
  if (!passwordCheck.ok) {
    return { ok: false as const, status: 400, message: passwordCheck.message };
  }

  const [user, admin] = await Promise.all([findUserByEmail(email), findAdminByEmail(email)]);
  if (!user && !admin) {
    logAuthEvent("password_reset.requested_unknown_email", { email }, "warn");
    return {
      ok: true as const,
      accepted: true,
      email,
      expiresInMinutes: 10,
      testOtp: undefined as string | undefined,
    };
  }

  const created = await createPasswordResetOtp({
    email,
    newPassword: payload.newPassword,
  });

  try {
    await sendOtpEmail({
      to: email,
      otp: created.otp,
      purpose: "password_reset",
      expiresInMinutes: created.expiresInMinutes,
    });
  } catch (error) {
    logAuthEvent(
      "password_reset.email_failed",
      { email, error: error instanceof Error ? error.message : String(error) },
      "error"
    );
    return { ok: false as const, status: 502, message: "Failed to send OTP email" };
  }

  logAuthEvent("password_reset.otp_created", { email });
  return {
    ok: true as const,
    accepted: true,
    email: created.email,
    expiresInMinutes: created.expiresInMinutes,
    testOtp: created.otp,
  };
};

export const confirmPasswordReset = async (payload: { email: string; otp: string }) => {
  const email = normalizeEmail(payload.email);
  if (!isValidEmailFormat(email)) {
    return { ok: false as const, status: 400, message: "Invalid email address" };
  }

  const consumed = await consumePasswordResetOtp({ email, otp: payload.otp });
  if (!consumed) {
    logAuthEvent("password_reset.invalid_otp", { email }, "warn");
    return { ok: false as const, status: 400, message: "Invalid or expired OTP" };
  }

  const [userUpdated, adminUpdated] = await Promise.all([
    updateUserPasswordHashByEmail({ email, passwordHash: consumed.passwordHash }),
    updateAdminPasswordHashByEmail({ email, passwordHash: consumed.passwordHash }),
  ]);

  if (!userUpdated && !adminUpdated) {
    logAuthEvent("password_reset.no_account_updated", { email }, "warn");
    return { ok: false as const, status: 404, message: "Account not found" };
  }

  await revokeSessionsByEmail(email);
  logAuthEvent("password_reset.completed", {
    email,
    userUpdated,
    adminUpdated,
  });

  return { ok: true as const };
};

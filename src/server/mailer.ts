import nodemailer from "nodemailer";

import { logEvent } from "@/server/logger";

const SMTP_HOST = process.env.SES_SMTP_HOST;
const SMTP_PORT = Number(process.env.SES_SMTP_PORT ?? 587);
const SMTP_USER = process.env.SES_USER;
const SMTP_PASS = process.env.SES_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && EMAIL_FROM);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) => {
  if (!isConfigured || !transporter) {
    const message = "Email transport not configured (SES env vars missing)";
    logEvent(process.env.NODE_ENV === "production" ? "error" : "warn", "email.disabled", {
      reason: message,
    });
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    return { skipped: true } as const;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      logEvent("info", "email.sent", {
        to: options.to,
        messageId: info.messageId,
        attempt,
      });
      return { ok: true as const, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      logEvent("warn", "email.send_failed", {
        to: options.to,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      await delay(200 * attempt);
    }
  }

  logEvent("error", "email.send_exhausted", {
    to: options.to,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const sendOtpEmail = async (payload: {
  to: string;
  otp: string;
  purpose: "signup" | "password_reset";
  expiresInMinutes: number;
}) => {
  const subject =
    payload.purpose === "signup"
      ? "Your NRI Legal signup verification code"
      : "Your NRI Legal password reset code";

  const text = `Your verification code is ${payload.otp}. It expires in ${payload.expiresInMinutes} minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p>Use the verification code below:</p>
      <p style="font-size: 28px; letter-spacing: 4px; font-weight: 700;">${payload.otp}</p>
      <p>This code expires in ${payload.expiresInMinutes} minutes. If you did not request this, please ignore.</p>
    </div>
  `;

  const maskedOtp = `${payload.otp.slice(0, 2)}****`;
  logEvent("info", "otp.email_sending", {
    to: payload.to,
    purpose: payload.purpose,
    otpPreview: maskedOtp,
  });

  return sendEmail({
    to: payload.to,
    subject,
    text,
    html,
  });
};

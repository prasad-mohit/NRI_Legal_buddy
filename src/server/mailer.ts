/**
 * Minimal SMTP mailer using Node.js built-in modules only (no external deps).
 * Supports STARTTLS (port 587) and implicit TLS (port 465).
 * Compatible with AWS SES SMTP, SendGrid, Mailgun SMTP, etc.
 *
 * Set env vars: SES_SMTP_HOST, SES_SMTP_PORT, SES_USER, SES_PASS, EMAIL_FROM
 * If not configured the function skips silently in dev and logs an error in prod.
 */
import { createConnection } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";

import { logEvent } from "@/server/logger";

const SMTP_HOST = process.env.SES_SMTP_HOST;
const SMTP_PORT = Number(process.env.SES_SMTP_PORT ?? 587);
const SMTP_USER = process.env.SES_USER;
const SMTP_PASS = process.env.SES_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && EMAIL_FROM);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Minimal SMTP-over-TLS sender using only Node built-ins. */
const sendSmtp = (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) =>
  new Promise<{ messageId: string }>((resolve, reject) => {
    const host = SMTP_HOST!;
    const port = SMTP_PORT;
    const user = SMTP_USER!;
    const pass = SMTP_PASS!;
    const from = EMAIL_FROM!;
    const useTls = port === 465;

    const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@nri-law-buddy>`;
    const boundary = `----=_Part_${Date.now().toString(36)}`;

    const buildMessage = () => {
      const crlf = "\r\n";
      const headers = [
        `From: ${from}`,
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        `Message-ID: ${msgId}`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`,
        options.html
          ? `Content-Type: multipart/alternative; boundary="${boundary}"`
          : `Content-Type: text/plain; charset=UTF-8`,
      ].join(crlf);

      const body = options.html
        ? [
            `--${boundary}`,
            `Content-Type: text/plain; charset=UTF-8`,
            ``,
            options.text,
            `--${boundary}`,
            `Content-Type: text/html; charset=UTF-8`,
            ``,
            options.html,
            `--${boundary}--`,
          ].join(crlf)
        : options.text;

      return `${headers}${crlf}${crlf}${body}`;
    };

    const lines: string[] = [];
    let socket: ReturnType<typeof createConnection> | TLSSocket;

    const write = (line: string) => {
      (socket as { write: (s: string) => void }).write(line + "\r\n");
    };

    const onData = (data: Buffer) => {
      const incoming = data.toString();
      lines.push(incoming.trim());
      const code = parseInt(incoming.slice(0, 3), 10);

      if (incoming.includes("-") && !incoming.match(/^\d{3} /)) return; // multi-line

      if (code >= 500) {
        reject(new Error(`SMTP error ${code}: ${incoming.trim()}`));
        socket.destroy();
        return;
      }

      if (code === 220 && lines.length === 1) {
        write(`EHLO nri-law-buddy`);
      } else if (code === 250 && lines.length === 2) {
        if (!useTls && incoming.includes("STARTTLS")) {
          write("STARTTLS");
        } else {
          write(`AUTH LOGIN`);
        }
      } else if (code === 220 && lines.length === 3) {
        // STARTTLS accepted — upgrade socket
        const plain = socket as ReturnType<typeof createConnection>;
        socket = tlsConnect({ socket: plain, host, servername: host });
        socket.on("data", onData);
        socket.on("error", reject);
        write(`EHLO nri-law-buddy`);
        lines.push("tls-upgrade");
      } else if (code === 334 && !lines.some((l) => l.includes("UGFzc3dvcmQ6"))) {
        write(Buffer.from(user).toString("base64"));
      } else if (code === 334) {
        write(Buffer.from(pass).toString("base64"));
      } else if (code === 235) {
        write(`MAIL FROM:<${from}>`);
      } else if (code === 250 && incoming.includes("sender")) {
        write(`RCPT TO:<${options.to}>`);
      } else if (code === 250 && incoming.includes("recipient")) {
        write("DATA");
      } else if (code === 354) {
        write(buildMessage());
        write(".");
      } else if (code === 250 && incoming.toLowerCase().includes("queued")) {
        write("QUIT");
        resolve({ messageId: msgId });
      } else if (code === 221) {
        socket.destroy();
      }
    };

    const connectOpts = { host, port };
    socket = useTls ? tlsConnect({ ...connectOpts, servername: host }) : createConnection(connectOpts);
    socket.setTimeout(15_000);
    socket.on("data", onData);
    socket.on("error", reject);
    socket.on("timeout", () => reject(new Error("SMTP connection timed out")));
  });

export const sendEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) => {
  if (!isConfigured) {
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
      const info = await sendSmtp(options);
      logEvent("info", "email.sent", { to: options.to, messageId: info.messageId, attempt });
      return { ok: true as const, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      logEvent("warn", "email.send_failed", {
        to: options.to,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      await delay(300 * attempt);
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

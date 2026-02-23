import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 120_000;
const KEYLEN = 64;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, "sha512").toString(
    "hex"
  );
  return `${salt}:${derived}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, "sha512").toString(
    "hex"
  );
  if (hash.length !== derived.length) return false;
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(derived, "hex")
  );
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmailFormat = (email: string) =>
  EMAIL_REGEX.test(normalizeEmail(email));

export const validatePasswordStrength = (
  password: string
): { ok: true } | { ok: false; message: string } => {
  if (password.length < 10) {
    return { ok: false, message: "Password must be at least 10 characters long" };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: "Password must include a lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "Password must include an uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Password must include a number" };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: "Password must include a special character" };
  }
  return { ok: true };
};

export const adminPasswordHint = (password: string) => {
  const checksum = createHash("sha256").update(password).digest("hex");
  return `sha256:${checksum.slice(0, 8)}`;
};

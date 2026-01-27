import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 120_000;
const KEYLEN = 64;

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
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(derived, "hex")
  );
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const adminPasswordHint = (password: string) => {
  const checksum = createHash("sha256").update(password).digest("hex");
  return `sha256:${checksum.slice(0, 8)}`;
};

export type LogLevel = "info" | "warn" | "error";

const REDACT_KEYS = [
  "password",
  "otp",
  "token",
  "secret",
  "authorization",
  "cookie",
  "hash",
];

const shouldRedactKey = (key: string) =>
  REDACT_KEYS.some((item) => key.toLowerCase().includes(item));

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input)) {
      output[key] = shouldRedactKey(key) ? "[REDACTED]" : sanitizeValue(item, depth + 1);
    }
    return output;
  }
  return value;
};

export const logEvent = (
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {}
) => {
  const sanitizedMeta = sanitizeValue(meta) as Record<string, unknown>;
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitizedMeta,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
};

export const logAuthEvent = (
  event: string,
  meta: Record<string, unknown> = {},
  level: LogLevel = "info"
) => {
  logEvent(level, `auth.${event}`, meta);
};


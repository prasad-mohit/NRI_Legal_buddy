export const getRequestIpAddress = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

export const getRequestUserAgent = (req: Request) =>
  req.headers.get("user-agent") ?? "unknown";

export const getAuthRateLimitKey = (req: Request, email?: string) =>
  `${getRequestIpAddress(req)}|${(email ?? "no-email").toLowerCase()}`;

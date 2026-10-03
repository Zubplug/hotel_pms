type HeaderReader = { get(name: string): string | null };

/** Resolve the public origin for server-side booking links and internal calls. */
export function resolveBookingOrigin(requestHeaders: HeaderReader, configuredOrigin?: string | null) {
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0] ?? "https";
  const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
  return (requestOrigin || configuredOrigin || "https://getlodgecore.vercel.app").replace(/\/$/, "");
}

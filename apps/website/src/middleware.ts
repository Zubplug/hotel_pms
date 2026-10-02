import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PLATFORM_HOSTS = new Set([
  "book.lodgecore.com",
  "getlodgecore.vercel.app",
  "localhost",
  "127.0.0.1",
]);

function hostname(request: Request) {
  return new URL(request.url).hostname.toLowerCase();
}

function isAssetOrSpecialPath(pathname: string) {
  return pathname.startsWith("/_next/") || pathname.startsWith("/api/") || pathname.startsWith("/book/") || pathname === "/favicon.ico" || pathname.includes(".");
}

async function rewriteVerifiedCustomDomain(request: Request) {
  const url = new URL(request.url);
  const host = hostname(request);
  if (PLATFORM_HOSTS.has(host) || isAssetOrSpecialPath(url.pathname)) return null;

  // A custom domain enters at / and is rewritten internally to the existing
  // property booking route. Once on /book/[slug], all existing booking pages,
  // forms, API calls, and confirmation links continue to work unchanged.
  const lookupOrigin = process.env.NEXT_PUBLIC_BOOKING_URL || "https://book.lodgecore.com";
  try {
    const lookup = await fetch(
      `${lookupOrigin}/api/internal/booking-domain/resolve?domain=${encodeURIComponent(host)}`,
      { cache: "no-store", headers: { "x-booking-domain-host": host } }
    );
    if (!lookup.ok) return null;
    const result = await lookup.json() as { found?: boolean; slug?: string };
    if (!result.found || !result.slug) return null;

    const target = new URL(request.url);
    target.pathname = `/book/${result.slug}${url.pathname === "/" ? "" : url.pathname}`;
    return target;
  } catch {
    // Unknown/unavailable domain lookup must not break the main website.
    return null;
  }
}

export default auth(async (request) => {
  const customDomainTarget = await rewriteVerifiedCustomDomain(request);
  if (customDomainTarget) {
    const response = NextResponse.rewrite(customDomainTarget);
    response.headers.set("x-booking-domain-routed", "true");
    return response;
  }

  if (!request.nextUrl.pathname.startsWith("/portal/") || request.nextUrl.pathname === "/portal/login") return NextResponse.next();
  if (request.auth?.user) return NextResponse.next();
  const login = new URL("/portal/login", request.nextUrl);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(login);
});

export const config = { matcher: ["/:path*"] };

import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  if (!request.nextUrl.pathname.startsWith("/portal/") || request.nextUrl.pathname === "/portal/login") return NextResponse.next();
  if (request.auth?.user) return NextResponse.next();
  const login = new URL("/portal/login", request.nextUrl);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(login);
});

export const config = { matcher: ["/portal/:path*"] };

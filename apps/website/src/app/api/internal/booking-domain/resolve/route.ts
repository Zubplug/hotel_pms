import { NextRequest, NextResponse } from "next/server";
import prisma from "@hotel-pms/db";

/**
 * Host routing lookup used by middleware. It intentionally returns only the
 * public slug for a published, verified booking site.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
  if (!domain || domain.length > 253) {
    return NextResponse.json({ found: false }, { status: 400 });
  }

  const site = await prisma.bookingSite.findFirst({
    where: {
      customDomain: domain,
      domainStatus: { in: ["VERIFIED", "ACTIVE"] },
      status: "PUBLISHED",
    },
    select: { publicSlug: true },
  });

  if (!site) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ found: true, slug: site.publicSlug }, { headers: { "Cache-Control": "private, max-age=30" } });
}

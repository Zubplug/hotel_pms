import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";

const REACH_CODE = "ADDON_REACH";

async function getUser() {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  return user?.organizationId ? user : null;
}

function hasReachEntitlement(entitlements: { propertyId: string | null }[], propertyId: string) {
  return entitlements.some((entitlement) => entitlement.propertyId === null || entitlement.propertyId === propertyId);
}

export async function GET() {
  const user = await getUser();
  if (!user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [properties, entitlements] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.entitlement.findMany({
      where: { organizationId: user.organizationId, productCode: REACH_CODE, status: "ACTIVE" },
      select: { propertyId: true },
    }),
  ]);
  const programs = await prisma.referralProgram.findMany({
    where: { organizationId: user.organizationId, propertyId: { in: properties.map((property) => property.id) } },
    select: { propertyId: true, enabled: true, activationPaymentStatus: true, pausedAt: true },
  });

  return NextResponse.json({
    properties: properties.map((property) => {
      const program = programs.find((item) => item.propertyId === property.id);
      return {
        id: property.id,
        name: property.name,
        entitled: hasReachEntitlement(entitlements, property.id),
        enabled: program?.enabled ?? false,
        activationPaymentStatus: program?.activationPaymentStatus ?? "NOT_PAID",
        pausedAt: program?.pausedAt?.toISOString() ?? null,
      };
    }),
  });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const propertyId = typeof body.propertyId === "string" ? body.propertyId : "";
  const enabled = body.enabled === true;
  if (!propertyId) return NextResponse.json({ error: "propertyId is required" }, { status: 400 });

  const [property, entitlement] = await Promise.all([
    prisma.property.findFirst({ where: { id: propertyId, organizationId: user.organizationId, isActive: true }, select: { id: true } }),
    prisma.entitlement.findFirst({ where: { organizationId: user.organizationId, productCode: REACH_CODE, status: "ACTIVE", OR: [{ propertyId }, { propertyId: null }] }, select: { id: true } }),
  ]);
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  if (!entitlement) return NextResponse.json({ error: "The LodgeCore Reach add-on is not active for this property" }, { status: 402 });

  const now = new Date();
  const program = await prisma.referralProgram.upsert({
    where: { propertyId },
    create: { organizationId: user.organizationId, propertyId, enabled, activationPaymentStatus: "PAID", activatedAt: enabled ? now : null, pausedAt: enabled ? null : now },
    update: { enabled, activationPaymentStatus: "PAID", ...(enabled ? { activatedAt: now, pausedAt: null } : { pausedAt: now }) },
  });
  return NextResponse.json({ propertyId, enabled: program.enabled });
}

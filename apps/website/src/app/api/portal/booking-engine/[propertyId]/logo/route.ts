import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = await params;
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: user.organizationId, isActive: true },
    select: { id: true },
  });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const entitlement = await prisma.entitlement.findFirst({
    where: { organizationId: user.organizationId, propertyId, productCode: "ADDON_BOOKING_ENGINE", status: "ACTIVE" },
    select: { id: true },
  });
  if (!entitlement) return NextResponse.json({ error: "Booking Engine entitlement is required" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("logo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a logo image" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Logo must be PNG, JPEG, or WebP" }, { status: 400 });
  if (file.size > MAX_LOGO_BYTES) return NextResponse.json({ error: "Logo must be 2 MB or smaller" }, { status: 400 });

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`booking-engine/${propertyId}/logo-${crypto.randomUUID()}.${extension}`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}

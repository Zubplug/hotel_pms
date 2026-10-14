import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { resolveBreakdownConfig, RoomRateBreakdownConfig } from '@/lib/room-rate-breakdown';
import { hasEntitlement, requireEntitlement } from '@/lib/auth/entitlement';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: propertyId } = await params;
    const ctx = await requireOrganizationContext((session.user as any).id);
    if (!ctx.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized property access' }, { status: 403 });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, organizationId: true, settings: true, baseCurrency: true },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const config = resolveBreakdownConfig(property.settings as any);
    return NextResponse.json({
      config,
      baseCurrency: property.baseCurrency || 'NGN',
      featureAvailable: await hasEntitlement(property.organizationId, 'MODULE_OPERATIONS', propertyId),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: propertyId } = await params;
    const ctx = await requireOrganizationContext((session.user as any).id);
    if (!ctx.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized property access' }, { status: 403 });
    }

    try {
      await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', propertyId);
    } catch {
      return NextResponse.json({ error: 'Room rate breakdown and food allocation require the Professional plan or higher.' }, { status: 402 });
    }

    // Role / Permission check: Only finance/accounting or managerial roles can alter GL rate breakdown settings
    const isAuthorized =
      ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'FINANCE_ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'HOTEL_MANAGER'].includes(
        ctx.role,
      ) ||
      ctx.permissions.some((p) =>
        ['FINANCE_ADMIN', 'MANAGE_SETTINGS', 'ACCOUNTANT', 'SETTINGS_MANAGE'].includes(p),
      );

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient privileges to update rate breakdown accounting settings' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const incomingConfig = body.config as Partial<RoomRateBreakdownConfig>;

    if (!incomingConfig) {
      return NextResponse.json({ error: 'Missing config payload' }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, settings: true },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const existingSettings = (property.settings as Record<string, any>) || {};
    const existingBreakdown = resolveBreakdownConfig(existingSettings);

    const nextVersion = (existingBreakdown.version || 1) + 1;
    const updatedBreakdown: RoomRateBreakdownConfig = {
      ...existingBreakdown,
      ...incomingConfig,
      version: nextVersion,
      glCodes: {
        ...existingBreakdown.glCodes,
        ...(incomingConfig.glCodes || {}),
      },
    };

    const updatedSettings = {
      ...existingSettings,
      roomRateBreakdown: updatedBreakdown,
      allowComplimentaryFoodOnDiscountedRooms: updatedBreakdown.allowComplimentaryFoodOnDiscountedRooms,
    };

    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: {
        settings: updatedSettings as any,
      },
      select: { id: true, settings: true },
    });

    return NextResponse.json({
      success: true,
      config: resolveBreakdownConfig(updatedProperty.settings as any),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

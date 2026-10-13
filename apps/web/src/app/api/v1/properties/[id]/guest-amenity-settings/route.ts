import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { assertPropertyAccess, ForbiddenError, NotFoundError } from '@/lib/property-access';
import { DEFAULT_GUEST_AMENITY_PACK } from '@/lib/services/guest-amenity-service';

type Params = { params: Promise<{ id: string }> };

async function authorize(propertyId: string, requireWrite = false) {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new ForbiddenError('Unauthorized property access');
  await assertPropertyAccess(session.user.id, propertyId);
  if (!requireWrite) return session;
  // Organization memberships and legacy role records are not guaranteed to
  // use the same casing. Normalize both sides so an Accountant can manage
  // these settings regardless of whether the stored value is `ACCOUNTANT`,
  // `accountant`, or a permission returned in lowercase.
  const role = String(ctx.role || '').trim().toUpperCase();
  const permissions = ctx.permissions.map((permission) => String(permission).trim().toUpperCase());
  const allowed = ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'FINANCE_ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'HOTEL_MANAGER'].includes(role)
    || permissions.some((permission) => ['FINANCE_ADMIN', 'MANAGE_SETTINGS', 'ACCOUNTANT', 'SETTINGS_MANAGE'].includes(permission));
  if (!allowed) throw new ForbiddenError('Insufficient privileges to update guest amenity settings');
  return session;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id: propertyId } = await params;
    // Loading the settings is read-only. Write privileges are checked by PUT.
    await authorize(propertyId, false);
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { settings: true, baseCurrency: true } });
    if (!property) throw new NotFoundError('Property not found');
    const warehouses = await prisma.warehouse.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } });
    const stockItems = await prisma.stockItem.findMany({
      where: { propertyId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, warehouseId: true, baseUnit: true, costPrice: true, quantityOnHand: true },
    });
    const settings = (property.settings as any) || {};
    return NextResponse.json({
      guestAmenities: settings.guestAmenities || { enabled: true, items: DEFAULT_GUEST_AMENITY_PACK },
      warehouses,
      stockItems: stockItems.map((item) => ({ ...item, costPrice: Number(item.costPrice), quantityOnHand: Number(item.quantityOnHand) })),
      baseCurrency: property.baseCurrency || 'NGN',
    });
  } catch (error: any) {
    const status = error instanceof ForbiddenError ? 403 : error instanceof NotFoundError ? 404 : error.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Unable to load guest amenity settings' }, { status });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: propertyId } = await params;
    await authorize(propertyId, true);
    const body = await request.json();
    const incoming = body?.guestAmenities;
    if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.items)) {
      return NextResponse.json({ error: 'guestAmenities.items is required' }, { status: 400 });
    }

    const warehouseId = String(incoming.warehouseId || '');
    const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, propertyId, isActive: true }, select: { id: true, name: true } });
    if (!warehouse || !/housekeeping|laundry/i.test(warehouse.name)) {
      return NextResponse.json({ error: 'Select an active housekeeping/laundry warehouse.' }, { status: 400 });
    }
    const itemIds = incoming.items.map((item: any) => String(item.stockItemId || '')).filter(Boolean);
    const stockItems = await prisma.stockItem.findMany({ where: { id: { in: itemIds }, propertyId, warehouseId, isActive: true }, select: { id: true } });
    if (stockItems.length !== itemIds.length) return NextResponse.json({ error: 'Every amenity item must belong to the selected housekeeping/laundry warehouse.' }, { status: 400 });

    const items = incoming.items.map((item: any) => ({
      key: String(item.key || item.stockItemId),
      name: String(item.name || '').trim(),
      stockItemId: String(item.stockItemId),
      quantityPerGuest: Math.max(0, Number(item.quantityPerGuest ?? 1)),
      expectedCost: Math.max(0, Number(item.expectedCost ?? 0)),
      aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
    })).filter((item: any) => item.name && item.quantityPerGuest > 0);
    if (!items.length) return NextResponse.json({ error: 'At least one active amenity item is required.' }, { status: 400 });

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { settings: true } });
    if (!property) throw new NotFoundError('Property not found');
    const settings = (property.settings as any) || {};
    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: { settings: { ...settings, guestAmenities: { enabled: Boolean(incoming.enabled), warehouseId, items } } as any },
      select: { settings: true },
    });
    return NextResponse.json({ success: true, guestAmenities: (updated.settings as any)?.guestAmenities });
  } catch (error: any) {
    const status = error instanceof ForbiddenError ? 403 : error instanceof NotFoundError ? 404 : error.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Unable to save guest amenity settings' }, { status });
  }
}

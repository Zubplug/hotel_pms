/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function context() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const ctx = await requireOrganizationContext(session.user.id);
  return { session, ctx };
}

const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR'];

function isManager(session: any, ctx: any) {
  const role = String((session.user as any).role || ctx.role || '').toUpperCase();
  return MANAGER_ROLES.includes(role);
}

export async function GET(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    const sp = req.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || (session.user as any).propertyId;
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const facilityId = sp.get('facilityId') || undefined;
    const includeInactive = sp.get('includeInactive') === 'true';

    const passTypes = await prisma.poolPassType.findMany({
      where: {
        propertyId,
        ...(facilityId ? { facilityId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        facility: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ facilityId: 'asc' }, { name: 'asc' }],
    });

    // Enrich with POS product name if productId linked
    const productIds = passTypes.map((p) => p.productId).filter(Boolean) as string[];
    const products = productIds.length
      ? await prisma.posProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, price: true, isActive: true, category: { select: { outletId: true } } },
        })
      : [];

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    const result = passTypes.map((pt) => ({
      ...pt,
      posProduct: pt.productId ? productMap[pt.productId] ?? null : null,
      entryCount: (pt as any)._count?.entries ?? 0,
    }));

    return NextResponse.json({ data: result });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    console.error('[POOL PASS TYPES GET]', err);
    return error('Internal Server Error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    if (!isManager(session, ctx)) return error('Only an authorized manager can manage pass types', 403);

    const body = await req.json();
    const propertyId = String(body.propertyId || (session.user as any).propertyId || '');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    if (!body.facilityId || !body.name || !body.code) return error('facilityId, name, and code are required');

    const facility = await prisma.poolFacility.findFirst({ where: { id: String(body.facilityId), propertyId, isActive: true } });
    if (!facility) return error('Facility not found', 404);

    const code = String(body.code).toUpperCase().trim();
    const existing = await prisma.poolPassType.findFirst({ where: { propertyId, code } });
    if (existing) return error(`Pass type code "${code}" already exists for this property`, 409);

    if (body.productId) {
      const product = await prisma.posProduct.findFirst({ where: { id: String(body.productId), propertyId, isActive: true } });
      if (!product) return error('Active POS product not found for this property', 404);
    }

    const passType = await prisma.poolPassType.create({
      data: {
        propertyId,
        facilityId: facility.id,
        name: String(body.name).trim(),
        code,
        guestClass: String(body.guestClass || 'ADULT').toUpperCase(),
        price: Number(body.price ?? 0),
        currency: String(body.currency || 'NGN').toUpperCase(),
        maxDuration: Number(body.maxDuration ?? 480),
        isComplimentary: Boolean(body.isComplimentary),
        productId: body.productId ? String(body.productId) : null,
        isActive: true,
      },
    });

    return NextResponse.json({ data: passType }, { status: 201 });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    if (err?.code === 'P2002') return error('Pass type code already exists for this property', 409);
    console.error('[POOL PASS TYPES POST]', err);
    return error('Internal Server Error', 500);
  }
}

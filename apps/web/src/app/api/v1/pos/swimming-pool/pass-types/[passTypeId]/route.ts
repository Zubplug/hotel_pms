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
  return MANAGER_ROLES.includes(String((session.user as any).role || ctx.role || '').toUpperCase());
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ passTypeId: string }> }) {
  try {
    const { session, ctx } = await context();
    const { passTypeId } = await params;
    const propertyId = req.nextUrl.searchParams.get('propertyId') || (session.user as any).propertyId;
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const passType = await prisma.poolPassType.findFirst({
      where: { id: passTypeId, propertyId },
      include: {
        facility: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
    });
    if (!passType) return error('Pass type not found', 404);

    // Get counts by status
    const entryCounts = await prisma.poolEntry.groupBy({
      by: ['status'],
      where: { passTypeId, propertyId },
      _count: { status: true },
    });
    const countMap = Object.fromEntries(entryCounts.map((e) => [e.status, e._count.status]));

    let posProduct = null;
    if (passType.productId) {
      posProduct = await prisma.posProduct.findFirst({
        where: { id: passType.productId },
        select: { id: true, name: true, price: true, isActive: true },
      });
    }

    return NextResponse.json({ data: { ...passType, posProduct, entryCounts: countMap } });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    console.error('[POOL PASS TYPE GET]', err);
    return error('Internal Server Error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ passTypeId: string }> }) {
  try {
    const { session, ctx } = await context();
    if (!isManager(session, ctx)) return error('Only an authorized manager can modify pass types', 403);
    const { passTypeId } = await params;
    const body = await req.json();
    const propertyId = String(body.propertyId || (session.user as any).propertyId || '');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const passType = await prisma.poolPassType.findFirst({ where: { id: passTypeId, propertyId } });
    if (!passType) return error('Pass type not found', 404);

    // Code uniqueness check if changing
    if (body.code && String(body.code).toUpperCase() !== passType.code) {
      const newCode = String(body.code).toUpperCase().trim();
      const collision = await prisma.poolPassType.findFirst({ where: { propertyId, code: newCode, id: { not: passTypeId } } });
      if (collision) return error(`Pass type code "${newCode}" already exists`, 409);
    }

    // POS product validation
    if (body.productId !== undefined) {
      if (body.productId) {
        const product = await prisma.posProduct.findFirst({ where: { id: String(body.productId), propertyId, isActive: true } });
        if (!product) return error('Active POS product not found for this property', 404);
      }
    }

    // Check for reserved entries when deactivating
    let warning: string | null = null;
    if (body.isActive === false && passType.isActive === true) {
      const reservedCount = await prisma.poolEntry.count({ where: { passTypeId, propertyId, status: 'RESERVED' } });
      if (reservedCount > 0) {
        warning = `Pass deactivated. ${reservedCount} reserved admission${reservedCount === 1 ? '' : 's'} still reference this pass — they can still be checked in.`;
      }
    }

    const updated = await prisma.poolPassType.update({
      where: { id: passTypeId },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.code !== undefined ? { code: String(body.code).toUpperCase().trim() } : {}),
        ...(body.guestClass !== undefined ? { guestClass: String(body.guestClass).toUpperCase() } : {}),
        ...(body.price !== undefined ? { price: Number(body.price) } : {}),
        ...(body.currency !== undefined ? { currency: String(body.currency).toUpperCase() } : {}),
        ...(body.maxDuration !== undefined ? { maxDuration: Number(body.maxDuration) } : {}),
        ...(body.isComplimentary !== undefined ? { isComplimentary: Boolean(body.isComplimentary) } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.productId !== undefined ? { productId: body.productId ? String(body.productId) : null } : {}),
      },
    });

    return NextResponse.json({ data: updated, ...(warning ? { warning } : {}) });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    if (err?.code === 'P2002') return error('Pass type code already exists for this property', 409);
    console.error('[POOL PASS TYPE PATCH]', err);
    return error('Internal Server Error', 500);
  }
}

// Pass types are never hard-deleted — use isActive=false
export async function DELETE() {
  return NextResponse.json(
    { error: 'Pass types cannot be deleted. Set isActive=false to deactivate. This preserves historical admission records.' },
    { status: 405 }
  );
}

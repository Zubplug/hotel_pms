import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    const modifiers = await prisma.posProductModifier.findMany({
      where: { productId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: modifiers, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Only managers can directly create live modifiers', 403);
    const { productId } = await params;
    const body = await req.json();
    const name = String(body.name || '').trim();
    const price = Number(body.price ?? 0);
    const quantity = Number(body.quantity ?? 1);
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) return errorResponse('BAD_REQUEST', 'Modifier name, valid price, and quantity are required', 400);

    const modifier = await prisma.posProductModifier.create({
      data: {
        productId,
        name,
        price,
        isActive: true,
        stockItemId: body.stockItemId || null,
        quantity,
        unitOfMeasure: body.unitOfMeasure || null,
        groupName: body.groupName ? String(body.groupName).trim() : null,
        groupRequired: body.groupRequired === true,
        groupMaxSelect: body.groupMaxSelect == null ? null : Number(body.groupMaxSelect),
      },
    });
    // Desktop incremental sync watches the parent product watermark because
    // modifiers do not have their own updatedAt column.
    await prisma.posProduct.update({ where: { id: productId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ data: modifier, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

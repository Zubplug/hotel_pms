import { NextResponse } from 'next/server';
import { WasteService } from '@/lib/inventory/WasteService';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';

export const POST = auth(async (req: any) => {
  if (!req.auth) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }
  const actorId = req.auth.user.id;

  try {
    const property = await prisma.property.findFirst({ where: { isActive: true } });
    if (!property) throw new Error('No active property found');

    const body = await req.json();
    const { stockItemId, outletId, quantity, unitOfMeasure, reason, notes } = body;

    const entry = await WasteService.submitWaste({
      propertyId: property.id,
      stockItemId,
      outletId,
      quantity: Number(quantity),
      unitOfMeasure,
      reason,
      notes,
    }, actorId);

    return NextResponse.json({ data: entry });
  } catch (error: any) {
    console.error('Waste POST error:', error);
    return NextResponse.json({ error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
});

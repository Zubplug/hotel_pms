import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const recentRoomsWithDiscount = await prisma.reservationRoom.findMany({
      where: { discountType: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { reservation: { select: { confirmationNumber: true } } }
    });

    const recentApprovals = await prisma.approvalRequest.findMany({
      where: { type: 'DISCOUNT' },
      orderBy: { requestedAt: 'desc' },
      take: 5
    });

    return NextResponse.json({
      recentRoomsWithDiscount,
      recentApprovals
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

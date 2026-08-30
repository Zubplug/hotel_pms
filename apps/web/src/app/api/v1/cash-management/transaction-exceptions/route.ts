import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    if (!propertyId) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Property ID is required' } }, { status: 400 });
    }

    const whereClause: any = { propertyId };

    if (status) {
      whereClause.status = status;
    }

    const exceptions = await prisma.transactionException.findMany({
      where: whereClause,
      include: {
        payment: {
          select: {
            amount: true,
            currency: true,
            method: true,
            reference: true,
            providerTransactionId: true,
            providerRef: true,
            createdAt: true,
            folio: {
              select: {
                folioNumber: true,
                reservation: {
                  select: { primaryGuest: true }
                }
              }
            },
            frontdeskSession: { select: { shiftReference: true, staff: { select: { firstName: true, lastName: true } } } }
          }
        },
        posPayment: {
          select: {
            amount: true,
            currency: true,
            method: true,
            reference: true,
            gatewayTransactionId: true,
            createdAt: true,
            order: {
              select: {
                id: true,
                outlet: { select: { name: true } }
              }
            },
            session: { select: { primaryOperator: { select: { firstName: true, lastName: true } } } }
          }
        }
      },
      orderBy: { questionedAt: 'desc' },
      take: 200
    });

    return NextResponse.json({ data: exceptions });
  } catch (error: any) {
    console.error('Error fetching transaction exceptions:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } }, { status: 500 });
  }
}

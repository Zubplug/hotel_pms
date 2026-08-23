import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await prisma.posSession.findUnique({
      where: { id: sessionId },
      include: {
        outlet: true,
        primaryOperator: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const movements = await prisma.posCashMovement.findMany({
      where: { posSessionId: sessionId }
    });

    const payments = await prisma.posPayment.findMany({
      where: { sessionId: sessionId, status: 'CONFIRMED' }
    });

    const openingFloat = Number(session.openingCash) + movements.filter(m => m.type === 'FLOAT_ADJUSTMENT').reduce((sum, m) => sum + Number(m.amount), 0);
    
    // Sales breakdown
    const cashSales = payments.filter(p => p.method === 'CASH').reduce((sum, p) => sum + Number(p.amount), 0);
    const cardSales = payments.filter(p => p.method === 'CARD').reduce((sum, p) => sum + Number(p.amount), 0);
    const bankTransferSales = payments.filter(p => p.method === 'BANK_TRANSFER').reduce((sum, p) => sum + Number(p.amount), 0);
    const roomChargeSales = payments.filter(p => p.method === 'ROOM_CHARGE').reduce((sum, p) => sum + Number(p.amount), 0);
    const otherSales = payments.filter(p => !['CASH', 'CARD', 'BANK_TRANSFER', 'ROOM_CHARGE'].includes(p.method)).reduce((sum, p) => sum + Number(p.amount), 0);
    const totalSales = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const cashIn = movements.filter(m => m.type === 'CASH_TRANSFER_IN').reduce((sum, m) => sum + Number(m.amount), 0);
    const cashDrops = movements.filter(m => m.type === 'CASH_DROP').reduce((sum, m) => sum + Number(m.amount), 0);
    const paidOuts = movements.filter(m => m.type === 'PAID_OUT').reduce((sum, m) => sum + Number(m.amount), 0);
    const transfersOut = movements.filter(m => m.type === 'CASH_TRANSFER_OUT').reduce((sum, m) => sum + Number(m.amount), 0);
    const refunds = 0; // Refunds handled differently in POS phase 1

    const expectedCash = openingFloat + cashSales + cashIn - cashDrops - paidOuts - transfersOut - refunds;

    return NextResponse.json({ 
      data: {
        ...session,
        cashSales,
        cardSales,
        bankTransferSales,
        roomChargeSales,
        otherSales,
        totalSales,
        openingBalance: openingFloat,
        expectedCash,
        cashPaidOut: cashDrops + paidOuts + transfersOut,
        cashRefunds: refunds,
      } 
    });
  } catch (error) {
    console.error('Fetch POS Session Context Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getUserPropertyIds } from '@/lib/property-access';

const n = (value: unknown) => Number(value ?? 0);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sessionId } = await params;
    const posSession = await prisma.posSession.findUnique({
      where: { id: sessionId },
      include: {
        outlet: { select: { id: true, name: true } },
        primaryOperator: { select: { id: true, firstName: true, lastName: true, position: true } },
        orders: { select: { id: true, orderNumber: true, total: true, status: true, paymentStatus: true, createdAt: true, closedAt: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        cashMovements: { orderBy: { createdAt: 'desc' } },
        settlements: { orderBy: { settledAt: 'desc' }, take: 1 },
      },
    });
    if (!posSession) return NextResponse.json({ error: 'POS session not found' }, { status: 404 });
    const allowed = await getUserPropertyIds(session.user.id);
    if (!posSession.propertyId || !allowed.includes(posSession.propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const totalBy = (method: string) => posSession.payments.filter(payment => payment.method === method).reduce((sum, payment) => sum + n(payment.amount), 0);
    const movementBy = (types: string[]) => posSession.cashMovements.filter(movement => types.includes(movement.type)).reduce((sum, movement) => sum + n(movement.amount), 0);
    const paymentMethods = posSession.payments.reduce((result: Record<string, { count: number; amount: number }>, payment) => {
      const key = payment.method || 'OTHER';
      result[key] ||= { count: 0, amount: 0 };
      result[key].count += 1;
      result[key].amount += n(payment.amount);
      return result;
    }, {});

    const cashSales = totalBy('CASH');
    const cashRefunds = movementBy(['REFUND', 'REFUND_CASH']);
    const expectedCash = n(posSession.openingCash) + cashSales + movementBy(['CASH_IN', 'CASH_TRANSFER_IN']) - movementBy(['CASH_DROP', 'PAID_OUT', 'CASH_TRANSFER_OUT']) - cashRefunds;
    const rows = posSession.payments.map(payment => {
      const order = posSession.orders.find(item => item.id === payment.orderId);
      return { id: payment.id, type: 'PAYMENT', date: payment.createdAt, orderId: payment.orderId, orderNumber: order?.orderNumber || null, method: payment.method, amount: n(payment.amount), currency: payment.currency, status: payment.status, operatorId: payment.processedById || posSession.openedBy, reference: payment.reference || payment.gatewayTransactionId || null };
    });

    return NextResponse.json({ data: {
      session: posSession,
      expectedCash,
      variance: posSession.variance == null ? null : n(posSession.variance),
      openingBalance: n(posSession.openingCash),
      cashSales,
      cardSales: totalBy('CARD') + totalBy('CARD_OFFLINE') + totalBy('POS'),
      bankTransferSales: totalBy('BANK_TRANSFER'),
      roomChargeSales: totalBy('ROOM_CHARGE'),
      otherSales: posSession.payments.filter(payment => !['CASH', 'CARD', 'CARD_OFFLINE', 'POS', 'BANK_TRANSFER', 'ROOM_CHARGE'].includes(payment.method)).reduce((sum, payment) => sum + n(payment.amount), 0),
      totalSales: posSession.payments.reduce((sum, payment) => sum + n(payment.amount), 0),
      cashIn: movementBy(['CASH_IN', 'CASH_TRANSFER_IN']),
      cashDrops: movementBy(['CASH_DROP']),
      paidOuts: movementBy(['PAID_OUT']),
      transfersOut: movementBy(['CASH_TRANSFER_OUT']),
      cashRefunds,
      paymentMethods,
      paymentCount: posSession.payments.length,
      orderCount: posSession.orders.length,
      rows,
      settlement: posSession.settlements[0] || null,
    } });
  } catch (error) {
    console.error('[POS settlement details]', error);
    return NextResponse.json({ error: 'Unable to load settlement details' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    let targetUserId = searchParams.get('userId');

    if (!propertyId || !startDate || !endDate) {
      return errorResponse('BAD_REQUEST', 'Missing required query parameters: propertyId, startDate, endDate', 400);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const userRole = (session.user as any).role || 'STAFF';
    const capabilities = (session.user as any).capabilities || [];

    // Role-based restrictions
    const reportRoles = ['CEO', 'SUPER_ADMIN', 'MANAGER', 'ADMIN', 'ACCOUNTANT', 'GENERAL_CASHIER'];
    if (!capabilities.includes('ACCESS_REPORTS') && !capabilities.includes('ACCESS_MANAGEMENT') && !reportRoles.includes(String(userRole).toUpperCase())) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions for shift reporting', 403);
    }

    const canViewAllUsers = capabilities.includes('ACCESS_MANAGEMENT') || ['CEO', 'SUPER_ADMIN', 'MANAGER', 'ADMIN', 'ACCOUNTANT', 'GENERAL_CASHIER'].includes(String(userRole).toUpperCase());
    if (!canViewAllUsers) {
      // Staff without management capability can only see their own transactions
      targetUserId = session.user.id;
    } else {
      // They can specify a targetUserId or leave it null to get all users
    }

    const dateFilter = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };

    const paymentWhere: any = {
      propertyId,
      createdAt: dateFilter,
      status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }
    };
    
    if (targetUserId) {
      paymentWhere.receivedBy = targetUserId;
    }

    // 1. Fetch Front Desk gross payments
    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      include: {
        folio: {
          include: {
            reservation: {
              include: { primaryGuest: true }
            }
          }
        }
      }
    });

    // 2. Fetch Front Desk refunds
    const refundWhere: any = {
      propertyId,
      createdAt: dateFilter,
      status: 'COMPLETED'
    };
    if (targetUserId) {
      refundWhere.authorizedBy = targetUserId;
    }

    const refunds = await prisma.refund.findMany({
      where: refundWhere,
      include: {
        payment: { 
          include: {
            folio: {
              include: {
                reservation: {
                  include: { primaryGuest: true }
                }
              }
            }
          }
        }
      }
    });

    // POS sessions are part of the cashier's accountability packet as well.
    // Keep them in this report instead of forcing General Cashier to reconcile
    // POS and Front Desk through separate, incomplete screens.
    const posSessions = await prisma.posSession.findMany({
      where: {
        propertyId,
        businessDate: dateFilter,
        ...(targetUserId ? { openedBy: targetUserId } : {}),
      },
      orderBy: [{ businessDate: 'desc' }, { openedAt: 'desc' }],
      include: {
        outlet: { select: { id: true, name: true } },
        primaryOperator: { select: { id: true, firstName: true, lastName: true, position: true } },
        orders: { select: { id: true, orderNumber: true, total: true, status: true, paymentStatus: true, createdAt: true, closedAt: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        cashMovements: { orderBy: { createdAt: 'desc' } },
        settlements: { orderBy: { settledAt: 'desc' }, take: 1 },
      },
    });
    const syncConflicts = await prisma.syncConflict.count({
      where: { propertyId, createdAt: dateFilter, status: 'PENDING' },
    });

    // 3. Aggregate Gross, Refunds, and Net by PaymentMethod
    const aggregation: Record<string, { count: number, refundCount: number, payments: number, refunds: number, net: number }> = {};

    for (const p of payments) {
      if (!aggregation[p.method]) aggregation[p.method] = { count: 0, refundCount: 0, payments: 0, refunds: 0, net: 0 };
      aggregation[p.method].count += 1;
      const amount = Number(p.amount);
      aggregation[p.method].payments += amount;
      aggregation[p.method].net += amount;
    }

    for (const r of refunds) {
      const method = r.method || r.payment.method;
      if (!aggregation[method]) aggregation[method] = { count: 0, refundCount: 0, payments: 0, refunds: 0, net: 0 };
      aggregation[method].refundCount += 1;
      const amount = Number(r.amount);
      aggregation[method].refunds += amount;
      aggregation[method].net -= amount;
    }

    const posAggregation: Record<string, { count: number; gross: number; refunds: number; net: number }> = {};
    const posRows = posSessions.flatMap((posSession: any) => posSession.payments.map((payment: any) => ({
      id: payment.id,
      type: 'POS_PAYMENT',
      date: payment.createdAt,
      sessionId: posSession.id,
      outlet: posSession.outlet?.name || 'POS',
      shiftReference: posSession.id,
      orderId: payment.orderId,
      orderNumber: posSession.orders.find((order: any) => order.id === payment.orderId)?.orderNumber || null,
      method: payment.method,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      operatorId: payment.processedById || posSession.openedBy,
      businessDate: posSession.businessDate,
    })));

    for (const row of posRows.filter((row: any) => ['CONFIRMED', 'PAID'].includes(row.status))) {
      const method = row.method || 'OTHER';
      if (!posAggregation[method]) posAggregation[method] = { count: 0, gross: 0, refunds: 0, net: 0 };
      posAggregation[method].count += 1;
      posAggregation[method].gross += row.amount;
      posAggregation[method].net += row.amount;
    }

    const posCash = posSessions.reduce((sum: number, item: any) => sum + Number(item.cashSales || 0), 0);
    const posCard = posSessions.reduce((sum: number, item: any) => sum + item.payments.filter((p: any) => ['CARD', 'CARD_OFFLINE', 'POS'].includes(p.method)).reduce((s: number, p: any) => s + Number(p.amount), 0), 0);
    const posBankTransfer = posSessions.reduce((sum: number, item: any) => sum + item.payments.filter((p: any) => p.method === 'BANK_TRANSFER').reduce((s: number, p: any) => s + Number(p.amount), 0), 0);
    const posTotal = posSessions.reduce((sum: number, item: any) => sum + item.payments.filter((p: any) => ['CONFIRMED', 'PAID'].includes(p.status)).reduce((s: number, p: any) => s + Number(p.amount), 0), 0);
    const posRefunds = posSessions.reduce((sum: number, item: any) => sum + Number(item.cashRefunds || 0), 0);

    const shifts = posSessions.map((item: any) => {
      const settlement = item.settlements[0] || null;
      const movementTotal = (type: string) => item.cashMovements.filter((movement: any) => movement.type === type).reduce((sum: number, movement: any) => sum + Number(movement.amount), 0);
      return {
        id: item.id,
        type: 'POS',
        businessDate: item.businessDate,
        status: item.status,
        outlet: item.outlet,
        operator: item.primaryOperator,
        deviceId: item.deviceId,
        openedAt: item.openedAt,
        closedAt: item.closedAt,
        bankingModel: item.bankingModel,
        bankType: item.bankType,
        openingFloat: Number(item.openingCash),
        expectedCash: Number(item.expectedCash),
        declaredCash: item.actualCash == null ? null : Number(item.actualCash),
        variance: item.variance == null ? null : Number(item.variance),
        orderCount: item.orders.length,
        completedOrders: item.orders.filter((order: any) => order.status === 'CLOSED').length,
        voidedOrders: item.orders.filter((order: any) => order.status === 'VOIDED').length,
        paymentCount: item.payments.length,
        paymentTotals: item.payments.reduce((result: Record<string, number>, payment: any) => {
          result[payment.method] = (result[payment.method] || 0) + Number(payment.amount);
          return result;
        }, {}),
        cashMovements: {
          cashIn: movementTotal('CASH_TRANSFER_IN') + movementTotal('CASH_IN'),
          cashDrops: movementTotal('CASH_DROP'),
          paidOuts: movementTotal('PAID_OUT'),
          transfersOut: movementTotal('CASH_TRANSFER_OUT'),
          refunds: movementTotal('REFUND') + movementTotal('REFUND_CASH'),
        },
        settlement,
      };
    });

    // 4. Audit Log the report access
    await prisma.auditLog.create({
      data: {
        organizationId: (await prisma.property.findUnique({ where: { id: propertyId } }))?.organizationId || '',
        propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: userRole,
        action: 'REPORT_ACCESSED',
        resource: 'ShiftReport',
        resourceId: targetUserId || 'ALL_USERS',
        newValue: { startDate, endDate },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
      }
    });

    return successResponse({
      propertyId,
      startDate,
      endDate,
      userId: targetUserId || 'ALL',
      summary: aggregation,
      cashierTotals: {
        frontDeskGross: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
        frontDeskRefunds: refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
        posGross: posTotal,
        posRefunds,
        gross: payments.reduce((sum, payment) => sum + Number(payment.amount), 0) + posTotal,
        refunds: refunds.reduce((sum, refund) => sum + Number(refund.amount), 0) + posRefunds,
        net: payments.reduce((sum, payment) => sum + Number(payment.amount), 0) + posTotal - refunds.reduce((sum, refund) => sum + Number(refund.amount), 0) - posRefunds,
        posPaymentMethods: posAggregation,
        posCash,
        posCard,
        posBankTransfer,
        posSessions: posSessions.length,
        pendingSyncConflicts: syncConflicts,
      },
      items: { payments, refunds, posPayments: posRows },
      shifts,
    }, 200);

  } catch (err: any) {
    console.error('[Shift Report GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating shift report', 500);
  }
}

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
    const shiftId = searchParams.get('shiftId');
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

    const selectedFrontdeskSession = shiftId
      ? await prisma.frontdeskSession.findFirst({ where: { id: shiftId, propertyId }, select: { id: true } })
      : null;

    const paymentWhere: any = {
      propertyId,
      status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }
    };
    if (selectedFrontdeskSession) {
      paymentWhere.frontdeskSessionId = shiftId;
    } else if (!shiftId) {
      paymentWhere.createdAt = dateFilter;
    } else {
      // POS payments live in PosPayment; prevent unrelated front-desk
      // payments from appearing in a POS shift report.
      paymentWhere.id = '__NO_FRONTDESK_PAYMENT_FOR_POS_SHIFT__';
    }
    
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
      status: 'COMPLETED'
    };
    if (selectedFrontdeskSession) {
      refundWhere.payment = { frontdeskSessionId: shiftId };
    } else if (!shiftId) {
      refundWhere.createdAt = dateFilter;
    } else {
      refundWhere.id = '__NO_FRONTDESK_REFUND_FOR_POS_SHIFT__';
    }
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
        ...(shiftId ? { id: shiftId } : { businessDate: dateFilter }),
        ...(targetUserId ? { openedBy: targetUserId } : {}),
      },
      orderBy: [{ businessDate: 'desc' }, { openedAt: 'desc' }],
      include: {
        outlet: { select: { id: true, name: true } },
        primaryOperator: { select: { id: true, firstName: true, lastName: true, position: true } },
        orders: { select: { id: true, orderNumber: true, total: true, status: true, paymentStatus: true, createdAt: true, closedAt: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        cashMovements: { orderBy: { createdAt: 'desc' } },
        receiptAudits: { orderBy: { createdAt: 'desc' } },
        authorizationAudits: { orderBy: { createdAt: 'desc' } },
        settlements: { orderBy: { settledAt: 'desc' }, take: 1 },
        controlAudits: { orderBy: { createdAt: 'desc' } },
      },
    });
    const frontdeskSessions = await prisma.frontdeskSession.findMany({
      where: {
        propertyId,
        ...(shiftId ? { id: shiftId } : { businessDate: dateFilter }),
      },
      orderBy: { openedAt: 'desc' },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true, position: true } },
        cashAccount: { select: { id: true, name: true, type: true } },
        payments: true,
        cashMovements: true,
        controlAudits: { orderBy: { createdAt: 'desc' } },
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
      reference: payment.reference || payment.gatewayTransactionId || payment.operationId || null,
      receiptAudits: posSession.receiptAudits.filter((receipt: any) => receipt.orderId === payment.orderId),
    })));

    const posOrders = posSessions.flatMap((posSession: any) => posSession.orders.map((order: any) => ({
      ...order,
      sessionId: posSession.id,
      outlet: posSession.outlet,
      operatorId: posSession.primaryOperator?.id || posSession.openedBy,
    })));
    const posCashMovements = posSessions.flatMap((posSession: any) => posSession.cashMovements.map((movement: any) => ({
      ...movement,
      sessionId: posSession.id,
      outlet: posSession.outlet,
    })));
    const posReceiptAudits = posSessions.flatMap((posSession: any) => posSession.receiptAudits.map((receipt: any) => ({
      ...receipt,
      sessionId: posSession.id,
      outlet: posSession.outlet,
    })));
    const posAuthorizationAudits = posSessions.flatMap((posSession: any) => posSession.authorizationAudits.map((audit: any) => ({
      ...audit,
      sessionId: posSession.id,
      outlet: posSession.outlet,
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

    const posShiftRows = posSessions.map((item: any) => {
      const settlement = item.settlements[0] || null;
      const movementTotal = (type: string) => item.cashMovements.filter((movement: any) => movement.type === type).reduce((sum: number, movement: any) => sum + Number(movement.amount), 0);
      return {
        id: item.id,
        type: 'POS',
        businessDate: item.businessDate,
        status: item.status,
        controlStatus: item.controlStatus,
        varianceStatus: item.varianceStatus,
        approvalDecision: item.approvalDecision,
        approvalNotes: item.approvalNotes,
        settlementStatus: settlement?.status || null,
        outlet: item.outlet,
        operator: item.primaryOperator,
        deviceId: item.deviceId,
        openedAt: item.openedAt,
        closedAt: item.closedAt,
        bankingModel: item.bankingModel,
        bankType: item.bankType,
        openingFloat: Number(item.openingCash),
        expectedCash: Number(item.openingCash || 0) + Number(item.cashSales || 0) + Number(item.cashIn || 0) - Number(item.cashRefunds || 0) - Number(item.cashOut || 0),
        declaredCash: item.actualCash == null ? null : Number(item.actualCash),
        variance: item.actualCash == null ? null : Number(item.actualCash) - (Number(item.openingCash || 0) + Number(item.cashSales || 0) + Number(item.cashIn || 0) - Number(item.cashRefunds || 0) - Number(item.cashOut || 0)),
        orderCount: item.orders.length,
        completedOrders: item.orders.filter((order: any) => order.status === 'CLOSED').length,
        voidedOrders: item.orders.filter((order: any) => order.status === 'VOIDED').length,
        paymentCount: item.payments.length,
        paymentTotals: item.payments.filter((payment: any) => ['CONFIRMED', 'PAID'].includes(payment.status)).reduce((result: Record<string, number>, payment: any) => {
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
        shiftControlAudits: item.shiftControlAudits,
      };
    });
    const frontdeskShiftRows = frontdeskSessions.map((item: any) => {
      const movementTotal = (types: string[]) => item.cashMovements.filter((movement: any) => types.includes(movement.type)).reduce((sum: number, movement: any) => sum + Number(movement.amount), 0);
      const cashPayments = item.payments.filter((payment: any) => payment.method === 'CASH' && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status)).reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
      const expectedCash = Number(item.openingFloat) + cashPayments + movementTotal(['CASH_IN', 'CASH_TRANSFER_IN']) - movementTotal(['REFUND', 'REFUND_CASH', 'PAID_OUT', 'CASH_DROP', 'CASH_TRANSFER_OUT']);
      return {
        id: item.id,
        type: 'FRONT_DESK',
        businessDate: item.businessDate,
        status: item.status,
        controlStatus: item.controlStatus,
        varianceStatus: item.varianceStatus,
        approvalDecision: item.approvalDecision,
        approvalNotes: item.approvalNotes,
        till: item.cashAccount,
        operator: item.staff,
        openedAt: item.openedAt,
        closedAt: item.closedAt,
        openingFloat: Number(item.openingFloat),
        expectedCash,
        declaredCash: item.declaredCash == null ? null : Number(item.declaredCash),
        variance: item.variance == null ? null : Number(item.variance),
        paymentCount: item.payments.length,
        paymentTotals: item.payments.filter((payment: any) => ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status)).reduce((result: Record<string, number>, payment: any) => {
          result[payment.method] = (result[payment.method] || 0) + Number(payment.amount);
          return result;
        }, {}),
        cashMovements: {
          cashIn: movementTotal(['CASH_TRANSFER_IN', 'CASH_IN']),
          cashDrops: movementTotal(['CASH_DROP']),
          paidOuts: movementTotal(['PAID_OUT']),
          transfersOut: movementTotal(['CASH_TRANSFER_OUT']),
          refunds: movementTotal(['REFUND', 'REFUND_CASH']),
        },
        shiftControlAudits: item.shiftControlAudits,
      };
    });
    const frontdeskCashMovements = frontdeskSessions.flatMap((session: any) => session.cashMovements.map((movement: any) => ({
      ...movement,
      sessionId: session.id,
      till: session.cashAccount,
    })));
    const shifts = [...posShiftRows, ...frontdeskShiftRows];

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
      shiftId,
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
      items: { payments, refunds, posPayments: posRows, posOrders, posCashMovements, frontdeskCashMovements, posReceiptAudits, posAuthorizationAudits },
      shifts,
    }, 200);

  } catch (err: any) {
    console.error('[Shift Report GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating shift report', 500);
  }
}

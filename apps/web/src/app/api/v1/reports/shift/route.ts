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
    if (!capabilities.includes('ACCESS_REPORTS') && !capabilities.includes('ACCESS_MANAGEMENT')) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions for shift reporting', 403);
    }

    if (!capabilities.includes('ACCESS_MANAGEMENT')) {
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

    // 1. Fetch Gross Payments
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

    // 2. Fetch Refunds
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

    // 3. Aggregate Gross, Refunds, and Net by PaymentMethod
    const aggregation: Record<string, { payments: number, refunds: number, net: number }> = {};

    for (const p of payments) {
      if (!aggregation[p.method]) aggregation[p.method] = { payments: 0, refunds: 0, net: 0 };
      const amount = Number(p.amount);
      aggregation[p.method].payments += amount;
      aggregation[p.method].net += amount;
    }

    for (const r of refunds) {
      const method = r.method || r.payment.method;
      if (!aggregation[method]) aggregation[method] = { payments: 0, refunds: 0, net: 0 };
      const amount = Number(r.amount);
      aggregation[method].refunds += amount;
      aggregation[method].net -= amount;
    }

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
      items: { payments, refunds }
    }, 200);

  } catch (err: any) {
    console.error('[Shift Report GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating shift report', 500);
  }
}

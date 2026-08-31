import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import crypto from 'crypto';
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const minBalanceStr = searchParams.get('minBalance');
    const minBalance = minBalanceStr ? Number(minBalanceStr) : 0;
    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Missing required query parameter: propertyId', 400);
    }
    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
    if (!allowedPropertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }
    // Role-based restrictions: All staff can view Receivables operationally for their property. 
    // They cannot modify it.
    // 1. Fetch unsettled folios
    const folios = await prisma.folio.findMany({
      where: {
        propertyId,
        balance: { gt: minBalance } // only positive balances (debt)
      },
      include: {
        guest: true,
        reservation: {
          include: { 
            reservationRooms: { 
              include: { room: true } 
            } 
          }
        },
        items: {
          where: { type: 'PAYMENT' },
          orderBy: { businessDate: 'desc' },
          take: 1
        }
      }
    });
    const now = new Date();
    const reportData = folios.map((f: any) => {
      let status = 'CURRENT';
      let daysOutstanding = 0;
      if (f.reservation) {
        const checkOutDate = new Date(f.reservation.checkOut);
        const isCheckedOut = f.reservation.status === 'CHECKED_OUT';
        if (isCheckedOut) {
          status = 'CHECKED_OUT';
        }
        // If today is past the checkout date and it's not checked out (or it is checked out but they still owe money days later)
        const diffTime = Math.abs(now.getTime() - checkOutDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (now > checkOutDate) {
          daysOutstanding = diffDays;
          if (daysOutstanding > 0) {
            status = 'OVERDUE';
          }
        }
      } else {
        // Non-reservation folio (e.g. Master Folio)
        const diffTime = Math.abs(now.getTime() - f.createdAt.getTime());
        daysOutstanding = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      const lastPayment = f.items.length > 0 ? f.items[0] : null;
      return {
        folioId: f.id,
        folioNumber: f.folioNumber,
        guest: f.guest ? {
          name: `${f.guest.firstName} ${f.guest.lastName}`,
          email: f.guest.email,
          phone: f.guest.phone
        } : null,
        reservation: f.reservation ? {
          id: f.reservation.id,
          confirmationNumber: f.reservation.confirmationNumber,
          checkIn: f.reservation.checkIn,
          checkOut: f.reservation.checkOut,
          status: f.reservation.status,
          room: f.reservation.reservationRooms?.[0]?.room?.number || null
        } : null,
        financials: {
          balance: Number(f.balance),
          currency: f.currency,
          totalCharges: Number(f.totalCharges),
          totalPayments: Number(f.totalPayments),
        },
        aging: {
          status, // CURRENT | CHECKED_OUT | OVERDUE
          daysOutstanding,
          lastPaymentDate: lastPayment ? lastPayment.businessDate : null,
          lastPaymentAmount: lastPayment ? Math.abs(Number(lastPayment.amount)) : 0
        }
      };
    });
    // 2. Audit Log the report access
    await prisma.auditLog.create({
      data: {
        organizationId: (await prisma.property.findUnique({ where: { id: propertyId } }))?.organizationId || '',
        propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: (session.user as any).role || 'STAFF',
        action: 'REPORT_ACCESSED',
        resource: 'ReceivablesReport',
        resourceId: propertyId,
        newValue: { minBalance, totalRecords: reportData.length },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
      }
    });
    return successResponse({
      propertyId,
      totalUnsettledFolios: reportData.length,
      receivables: reportData
    }, 200);
  } catch (err: any) {
    console.error('[Receivables Report GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating receivables report', 500);
  }
}

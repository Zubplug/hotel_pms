import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    if (!id) return errorResponse('BAD_REQUEST', 'Payment ID required', 400);
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        property: true,
        folio: {
          include: {
            reservation: {
              include: {
                primaryGuest: true,
                reservationRooms: {
                  include: {
                    room: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!payment) {
      return errorResponse('NOT_FOUND', 'Payment not found', 404);
    }
    // Authorization: User must have access to this property
    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
    if (!allowedPropertyIds.includes(payment.propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }
    // Must be COMPLETED to get a valid receipt
    if (payment.status !== 'COMPLETED' && payment.status !== 'REFUNDED') {
      return errorResponse('BAD_REQUEST', 'Cannot generate a receipt for an incomplete payment', 400);
    }
    // Fetch staff name for the cashier
    const staff = await prisma.staff.findUnique({
      where: { userId: payment.receivedBy }
    });
    const receivedByName = staff ? `${staff.firstName} ${staff.lastName}` : null;
    // Assemble the definitive, server-calculated receipt
    const receiptData = {
      receiptId: (payment as any).receiptNumber || `RCPT-${payment.id.split('-')[0].toUpperCase()}`,
      property: {
        name: payment.property.name,
        address: payment.property.address || 'Address on file',
        city: payment.property.city,
        country: payment.property.country,
        email: payment.property.email,
        phone: payment.property.phone
      },
      guest: payment.folio?.reservation?.primaryGuest ? {
        name: `${payment.folio.reservation.primaryGuest.firstName} ${payment.folio.reservation.primaryGuest.lastName}`,
        email: payment.folio.reservation.primaryGuest.email,
      } : null,
      reservation: payment.folio?.reservation ? {
        confirmationNumber: payment.folio.reservation.confirmationNumber,
        roomNumber: payment.folio.reservation.reservationRooms?.[0]?.room?.number || 'Unassigned',
        checkIn: payment.folio.reservation.checkIn,
        checkOut: payment.folio.reservation.checkOut,
      } : null,
      folio: {
        id: payment.folio.id,
        totalCharges: Number(payment.folio.totalCharges),
        totalPayments: Number(payment.folio.totalPayments),
        balance: Number(payment.folio.balance),
      },
      payment: {
        id: payment.id,
        date: payment.createdAt,
        amount: Number(payment.amount),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        provider: payment.provider,
        providerReference: payment.providerRef,
        providerTransactionId: payment.providerTransactionId,
        receivedBy: payment.receivedBy, // UUID of the staff member
        receivedByName: receivedByName
      }
    };
    return successResponse(receiptData, 200);
  } catch (err) {
    console.error('[Payment Receipt GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating receipt', 500);
  }
}

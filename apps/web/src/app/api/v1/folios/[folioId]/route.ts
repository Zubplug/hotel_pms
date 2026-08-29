import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ folioId: string }> }) {
  const session = await auth();
  if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const { folioId } = await params;
  const folio = await prisma.folio.findUnique({ where: { id: folioId }, include: { guest: true, reservation: { include: { reservationRooms: { include: { room: true } } } }, items: { orderBy: { businessDate: 'asc' } }, payments: { orderBy: { createdAt: 'desc' }, select: { id: true, amount: true, currency: true, method: true, status: true, receiptNumber: true, reference: true, collectionSource: true, receivedBy: true, createdAt: true } } } });
  if (!folio) return errorResponse('NOT_FOUND', 'Folio not found', 404);
  try { await assertPropertyAccess(session.user.id, folio.propertyId); } catch { return errorResponse('FORBIDDEN', 'No access to this folio', 403); }
  return successResponse({ ...folio, totalCharges: Number(folio.totalCharges), totalPayments: Number(folio.totalPayments), balance: Number(folio.balance), items: folio.items.map((item) => ({ ...item, amount: Number(item.amount), unitAmount: Number(item.unitAmount) })), payments: folio.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })) });
}

import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const businessDate = new Date(businessDateStr);

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    // 1. Fetch all Payments for this business date
    const payments = await prisma.payment.findMany({
      where: { propertyId, businessDate },
      include: {
        folio: {
          include: { guest: true, reservation: true }
        }
      }
    });

    // 2. Fetch all Refunds for this business date
    const refunds = await prisma.refund.findMany({
      where: { propertyId, businessDate },
      include: {
        folio: {
          include: { guest: true, reservation: true }
        },
        payment: true
      }
    });

    // Grouping by payment method
    const methodMap: Record<string, {
      method: string;
      payments: number;
      refunds: number;
      net: number;
      transactions: any[];
    }> = {};

    let totalPayments = 0;
    let totalRefunds = 0;
    let grandTotal = 0;

    payments.forEach(p => {
      if (!methodMap[p.method]) {
        methodMap[p.method] = { method: p.method, payments: 0, refunds: 0, net: 0, transactions: [] };
      }
      
      const amt = Number(p.amount);
      if (p.status === 'COMPLETED') {
        methodMap[p.method].payments += amt;
        methodMap[p.method].net += amt;
        totalPayments += amt;
        grandTotal += amt;

        methodMap[p.method].transactions.push({
          id: p.id,
          type: 'PAYMENT',
          folioId: p.folio.folioNumber || p.folio.id.slice(0, 8),
          guestName: p.folio.guest ? `${p.folio.guest.firstName} ${p.folio.guest.lastName}` : 'Walk-in',
          reference: p.reference || p.providerRef || 'N/A',
          amount: amt,
          timestamp: p.createdAt
        });
      }
    });

    refunds.forEach(r => {
      // Refunds tie to original payment method or their own method
      const method = r.method === 'ORIGINAL_PAYMENT' && r.payment ? r.payment.method : r.method;
      
      if (!methodMap[method]) {
        methodMap[method] = { method: method, payments: 0, refunds: 0, net: 0, transactions: [] };
      }

      const amt = Number(r.amount);
      if (r.status === 'COMPLETED') {
        methodMap[method].refunds += amt;
        methodMap[method].net -= amt;
        totalRefunds += amt;
        grandTotal -= amt;

        methodMap[method].transactions.push({
          id: r.id,
          type: 'REFUND',
          folioId: r.folio?.folioNumber || r.folio?.id.slice(0, 8) || 'Standalone refund',
          guestName: r.folio?.guest ? `${r.folio.guest.firstName} ${r.folio.guest.lastName}` : 'Guest credit',
          reference: r.providerRefundId || 'N/A',
          amount: -amt,
          timestamp: r.createdAt
        });
      }
    });

    // Convert map to array and sort transactions by time
    const methods = Object.values(methodMap).map(m => {
      m.transactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return m;
    });

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      methods,
      totals: {
        payments: totalPayments,
        refunds: totalRefunds,
        net: grandTotal
      }
    });

  } catch (err: any) {
    console.error('[Payment Reconciliation GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

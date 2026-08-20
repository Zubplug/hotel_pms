import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const provider = searchParams.get('provider') || 'PAYSTACK';

    if (!propertyId || !startDate || !endDate) {
      return errorResponse('BAD_REQUEST', 'Missing required query parameters: propertyId, startDate, endDate', 400);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const canReadReports = await hasPermission(session.user.id, 'reports', 'read', propertyId);
    if (!canReadReports && !(session.user as any).isSuperAdmin) {
      // Allow if they have report access or are super admin
      return errorResponse('FORBIDDEN', 'Insufficient permissions for gateway reconciliation', 403);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Fetch Local PMS Gateway Payments
    const localPayments = await prisma.payment.findMany({
      where: {
        propertyId,
        method: 'PAYMENT_GATEWAY',
        provider,
        createdAt: { gte: start, lte: end }
      },
      include: { refunds: true }
    });

    // 2. Fetch Provider Transactions
    let providerTransactions: any[] = [];
    if (provider === 'PAYSTACK') {
      const paystack = new PaystackProvider();
      providerTransactions = await paystack.fetchTransactions(start, end);
    } else {
      return errorResponse('BAD_REQUEST', 'Unsupported provider for reconciliation', 400);
    }

    // 3. Map and Reconcile
    const providerTxMap = new Map(providerTransactions.map(tx => [tx.providerRef, tx]));
    
    const reportData = [];
    const processedProviderRefs = new Set<string>();

    for (const lp of localPayments) {
      if (!lp.providerRef) continue;
      
      const pTx = providerTxMap.get(lp.providerRef);
      let reconciliationStatus = 'MATCHED';

      const totalRefunds = lp.refunds.reduce((sum: any, r: any) => sum + Number(r.amount), 0);
      const netPmsAmount = Number(lp.amount) - totalRefunds;

      if (!pTx) {
        reconciliationStatus = 'MISSING_PROVIDER_TRANSACTION';
      } else {
        processedProviderRefs.add(pTx.providerRef);

        const pmsStatusMap: Record<string, string> = {
          'COMPLETED': 'success',
          'PENDING': 'abandoned', // or pending
          'FAILED': 'failed',
          'REFUNDED': 'success', // Paystack original charge is still success, but refunded
          'PARTIALLY_REFUNDED': 'success'
        };

        const expectedProviderStatus = pmsStatusMap[lp.status] || 'unknown';

        if (pTx.amount !== Number(lp.amount)) {
          reconciliationStatus = 'AMOUNT_MISMATCH';
        } else if (pTx.status !== expectedProviderStatus && pTx.status !== 'success') { // Handle loose status mappings better in production
          reconciliationStatus = 'STATUS_MISMATCH';
        }
      }

      reportData.push({
        pmsPaymentId: lp.id,
        providerReference: lp.providerRef,
        providerTransactionId: lp.providerTransactionId || pTx?.providerTransactionId,
        pmsAmount: Number(lp.amount),
        refundAmount: totalRefunds,
        netPmsAmount,
        providerAmount: pTx ? pTx.amount : null,
        providerStatus: pTx ? pTx.status : null,
        pmsStatus: lp.status,
        reconciliationStatus,
        transactionDate: lp.createdAt,
        settlementDate: pTx ? pTx.settledAt : null // Payout/settlement date logic
      });
    }

    // Identify transactions that exist in Paystack but not in PMS
    for (const pTx of providerTransactions) {
      if (!processedProviderRefs.has(pTx.providerRef)) {
        reportData.push({
          pmsPaymentId: null,
          providerReference: pTx.providerRef,
          providerTransactionId: pTx.providerTransactionId,
          pmsAmount: null,
          refundAmount: null,
          netPmsAmount: null,
          providerAmount: pTx.amount,
          providerStatus: pTx.status,
          pmsStatus: null,
          reconciliationStatus: 'MISSING_PMS_TRANSACTION',
          transactionDate: pTx.createdAt,
          settlementDate: pTx.settledAt
        });
      }
    }

    // 4. Audit Log the report access
    await prisma.auditLog.create({
      data: {
        organizationId: (await prisma.property.findUnique({ where: { id: propertyId } }))?.organizationId || '',
        propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: 'STAFF',
        action: 'REPORT_ACCESSED',
        resource: 'GatewayReconciliationReport',
        resourceId: provider,
        newValue: { startDate, endDate, totalRecords: reportData.length },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
      }
    });

    return successResponse({
      propertyId,
      startDate,
      endDate,
      provider,
      reconciliation: reportData
    }, 200);

  } catch (err: any) {
    console.error('[Gateway Reconciliation GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating reconciliation report', 500);
  }
}

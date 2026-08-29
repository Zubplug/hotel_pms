import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { getOperationalReview, getSystemIntegrity, getFinancialAudit, getCashReconciliation } from '@/lib/night-audit-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    await assertPropertyAccess(session.user.id, propertyId);

    // Run all checks in parallel for maximum performance
    const [operational, system, financial, cash] = await Promise.all([
      getOperationalReview(propertyId),
      getSystemIntegrity(propertyId),
      getFinancialAudit(propertyId),
      getCashReconciliation(propertyId)
    ]);

    // Calculate readiness score
    let blockers = 0;
    let warnings = 0;

    // Operational blockers/warnings
    if (operational.arrivals.length > 0) warnings++;
    if (operational.departures.length > 0) warnings++;
    if (operational.roomReconciliation.some(r => r.issue)) warnings++;

    // System blockers/warnings
    if (system.openPosSessions.length > 0) blockers++;
    if (system.financialSyncConflicts.length > 0) blockers++;
    if (system.hardwareAgents.some(a => a.status === 'OFFLINE')) warnings++;

    // Financial blockers/warnings
    if (financial.highBalances.length > 0) warnings++;
    // Unposted transactions missing here - mock check for now
    
    // Cash blockers/warnings
    // Checking variances in UI
    
    return successResponse({
      operational,
      system,
      financial,
      cash,
      summary: { blockers, warnings }
    });

  } catch (err: any) {
    if (err.message && err.message.includes(':')) {
      const [code, msg] = err.message.split(':');
      const statusCode = code === 'NOT_FOUND' ? 404 : (code === 'FORBIDDEN' ? 403 : 409);
      return errorResponse(code, msg, statusCode);
    }
    console.error('[Night Audit Status GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

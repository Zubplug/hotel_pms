import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { getExecutiveKPISnapshot } from '@/lib/kpi';
import { evaluatePropertyAlerts } from '@/lib/attention-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    // Auth & Basic Capability Check
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    
    // Note: Eventually this will use capability-based auth (e.g., hasPermission('dashboard.view:executive'))
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'Executive access required', 403);
    }

    const allowedPropertyIds = user.allowedProperties;

    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    // Phase 1: We will aggregate the snapshot for the first property in the list
    // (Phase 3 handles multi-property consolidation properly)
    const primaryPropertyId = allowedPropertyIds[0];

    // Fetch the authoritative KPI snapshot using the dedicated foundation layer
    const snapshot = await getExecutiveKPISnapshot(primaryPropertyId);

    // Fetch the live Attention Engine alerts
    const activeAlerts = await evaluatePropertyAlerts(primaryPropertyId);

    return successResponse({
      kpi: snapshot,
      alerts: activeAlerts
    }, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Dashboard API]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating executive dashboard', 500);
  }
}

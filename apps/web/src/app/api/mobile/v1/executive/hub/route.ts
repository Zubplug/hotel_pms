import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { subMinutes } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    
    const isSystemAdmin = user.isSuperAdmin || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    
    if (!isSystemAdmin && !['MANAGER', 'DIRECTOR', 'GENERAL_MANAGER', 'EXECUTIVE', 'NIGHT_AUDITOR'].includes(user.role)) {
      return errorResponse('FORBIDDEN', 'Executive or Management access required', 403);
    }

    const ctx = await requireOrganizationContext(user.id);
    const allowedPropertyIds = ctx.propertyIds;

    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');

    // 1. Resolve Property Scope
    let targetProperties = [...allowedPropertyIds];
    let resolvedPropertyScope = propertyId || 'ALL_AUTHORIZED';

    if (propertyId === 'AUTO_SELECT_FIRST' && allowedPropertyIds.length > 0) {
      targetProperties = [allowedPropertyIds[0]];
      resolvedPropertyScope = allowedPropertyIds[0];
    } else if (propertyId && propertyId !== 'ALL_AUTHORIZED') {
      if (allowedPropertyIds.includes(propertyId)) {
        targetProperties = [propertyId];
        resolvedPropertyScope = propertyId;
      } else {
        return errorResponse('FORBIDDEN', 'Access denied to this property', 403);
      }
    }

    // 2. Compute Alerts
    // 2a. OOO Rooms
    const oooRoomsCount = await prisma.room.count({
      where: {
        propertyId: { in: targetProperties },
        status: 'OUT_OF_ORDER',
        isActive: true
      }
    });

    // 2b. Unresolved Cash Variances (PosSessions that are submitted/under_review with non-zero variance)
    const cashVariancesCount = await prisma.posSession.count({
      where: {
        outlet: { propertyId: { in: targetProperties } },
        controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        variance: { not: 0 }
      }
    });

    // 2c. Offline Terminals
    // A registered terminal with no heartbeat has never completed setup and is
    // not an operational outage. Only terminals that have reported at least
    // once are included in online/offline health counts. This prevents old
    // registration records from flooding the management alert queue.
    const fiveMinutesAgo = subMinutes(new Date(), 5);
    const offlineTerminalsCount = await prisma.posTerminal.count({
      where: {
        propertyId: { in: targetProperties },
        lastSeenAt: { lt: fiveMinutesAgo },
        registrationState: 'REGISTERED'
      }
    });

    // 3. Compute Approvals Summary
    const pendingApprovalsRaw = await prisma.approvalRequest.groupBy({
      by: ['type'],
      where: {
        propertyId: { in: targetProperties },
        status: 'PENDING'
      },
      _count: {
        id: true
      }
    });

    const [pendingExpenses, pendingReimbursements, pendingLoans, pendingAdvances] = await Promise.all([
      prisma.cashExpense.count({ where: { propertyId: { in: targetProperties }, status: 'PENDING_APPROVAL', currentApprovalStage: 'GENERAL_MANAGER' } }),
      prisma.expenseClaim.count({ where: { propertyId: { in: targetProperties }, status: 'GENERAL_MANAGER_REVIEW' } }),
      prisma.employeeLoan.count({ where: { propertyId: { in: targetProperties }, status: 'MANAGER_REVIEW' } }),
      prisma.salaryAdvance.count({ where: { propertyId: { in: targetProperties }, status: 'MANAGER_REVIEW' } }),
    ]);

    let totalPendingApprovals = 0;
    const approvalsByType = pendingApprovalsRaw.map(group => {
      totalPendingApprovals += group._count.id;
      return {
        type: group.type,
        count: group._count.id
      };
    });
    const additionalApprovalCounts = [
      ['EXPENSE', pendingExpenses],
      ['EMPLOYEE_REIMBURSEMENT', pendingReimbursements],
      ['EMPLOYEE_BENEFIT', pendingLoans + pendingAdvances],
    ] as const;
    for (const [type, count] of additionalApprovalCounts) {
      if (count > 0) approvalsByType.push({ type, count });
      totalPendingApprovals += count;
    }

    // 4. Compute System Status
    const frontDeskTerminalsTotal = await prisma.posTerminal.count({
      where: { propertyId: { in: targetProperties }, terminalType: 'FRONT_DESK', registrationState: 'REGISTERED', lastSeenAt: { not: null } }
    });
    const frontDeskTerminalsOnline = await prisma.posTerminal.count({
      where: { propertyId: { in: targetProperties }, terminalType: 'FRONT_DESK', registrationState: 'REGISTERED', lastSeenAt: { gte: fiveMinutesAgo } }
    });

    const posTerminalsTotal = await prisma.posTerminal.count({
      where: { propertyId: { in: targetProperties }, terminalType: { in: ['RESTAURANT_POS', 'BAR_POS'] }, registrationState: 'REGISTERED', lastSeenAt: { not: null } }
    });
    const posTerminalsOnline = await prisma.posTerminal.count({
      where: { propertyId: { in: targetProperties }, terminalType: { in: ['RESTAURANT_POS', 'BAR_POS'] }, registrationState: 'REGISTERED', lastSeenAt: { gte: fiveMinutesAgo } }
    });

    // Determine latest sync time across any terminal
    const latestSyncTerminal = await prisma.posTerminal.findFirst({
      where: { propertyId: { in: targetProperties }, lastSyncAt: { not: null } },
      orderBy: { lastSyncAt: 'desc' },
      select: { lastSyncAt: true }
    });

    // 5. Build Dynamic Management Modules based on permissions
    const modules = [];
    modules.push({ id: "reservations", title: "Reservations", icon: "book_online", route: "/reservations", enabled: true });
    
    if (isSystemAdmin || ['MANAGER', 'DIRECTOR', 'GENERAL_MANAGER', 'EXECUTIVE'].includes(user.role)) {
      modules.push({ id: "reports", title: "Reports", icon: "assessment", route: "/reports", enabled: true });
    }

    // Sync remains in the Control Centre because it supports operational
    // confidence across the property rather than duplicating a department.
    if (isSystemAdmin || user.role === 'DIRECTOR' || user.role === 'MANAGER') {
      modules.push({ id: "sync", title: "Sync", icon: "sync", route: "/sync", enabled: true });
    }

    const authorizedPropertiesDetails = await prisma.property.findMany({
      where: { id: { in: [...allowedPropertyIds] } },
      select: { id: true, name: true, code: true }
    });

    return successResponse({
      generatedAt: new Date().toISOString(),
      scope: {
        property: resolvedPropertyScope,
        availableProperties: authorizedPropertiesDetails
      },
      alerts: {
        oooRooms: oooRoomsCount,
        cashVariances: cashVariancesCount,
        offlineTerminals: offlineTerminalsCount,
      },
      approvalsSummary: {
        totalPending: totalPendingApprovals,
        byType: approvalsByType
      },
      systemStatus: {
        cloudConnected: true, // We are literally running in the cloud right now answering the API request
        frontDeskOnline: {
          online: frontDeskTerminalsOnline,
          total: frontDeskTerminalsTotal
        },
        posOnline: {
          online: posTerminalsOnline,
          total: posTerminalsTotal
        },
        lastSync: latestSyncTerminal?.lastSyncAt?.toISOString() || null,
        dataAsOf: new Date().toISOString()
      },
      modules
    }, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Hub GET]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Unexpected error fetching hub data', 500);
  }
}

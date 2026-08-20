import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { verifyMobileToken } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId'); // 'ALL_AUTHORIZED' or a specific UUID

    // 1. Resolve authorized properties
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });

    if (!user) return errorResponse('UNAUTHORIZED', 'User not found', 401);

    const staff = await prisma.staff.findFirst({
      where: user.staffId ? { id: user.staffId } : { userId: user.id },
      include: {
        organization: {
          include: {
            properties: {
              where: { isActive: true },
              select: { id: true }
            }
          }
        }
      }
    });

    const isSystemAdmin = user.roles.some((r: any) => r.role.name === 'ADMIN' || r.role.name === 'SUPER_ADMIN' || r.role.name === 'DIRECTOR');
    
    let allowedPropertyIds: string[] = [];
    if (staff && staff.organization) {
      if (isSystemAdmin) {
        allowedPropertyIds = staff.organization.properties.map((p: any) => p.id);
      } else if (staff.propertyAccess) {
        allowedPropertyIds = staff.propertyAccess;
      }
    }

    if (allowedPropertyIds.length === 0) {
      return successResponse({
        generatedAt: new Date().toISOString(),
        scope: { property: 'NONE' },
        summary: { pendingApprovals: 0, criticalInterventions: 0 },
        approvals: [],
        interventions: [],
        quickActions: [],
        executiveBrief: null
      }, 200);
    }

    // Filter by requested property if specified and authorized
    let targetProperties = allowedPropertyIds;
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

    // 2. Fetch Pending Approvals
    const pendingApprovalsRaw = await prisma.approvalRequest.findMany({
      where: {
        propertyId: { in: targetProperties },
        status: 'PENDING'
      },
      include: {
        property: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const staffIds = pendingApprovalsRaw.map((a: any) => a.requestedBy);
    const staffMembers = await prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, firstName: true, lastName: true, department: true }
    });
    
    const pendingApprovals = pendingApprovalsRaw.map((app: any) => {
      const staff = staffMembers.find((s: any) => s.id === app.requestedBy);
      return {
        ...app,
        requester: staff || { firstName: 'Unknown', lastName: 'Staff', department: 'Unknown' }
      };
    });

    // 3. Fetch P0/P1 Critical Interventions (from Notifications or a dedicated Alerts table)
    // We'll use the Notification table filtering for Critical/High priority
    const criticalInterventions = await prisma.notification.findMany({
      where: {
        recipientId: user.id,
        channel: 'in_app',
        priority: { in: ['Critical', 'High'] }, // Map to Critical/High
        readAt: null
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // 4. Determine Quick Actions based on Role/Capabilities
    const quickActions = [];
    if (isSystemAdmin || user.roles.some((r: any) => r.role.name === 'MANAGER' || r.role.name === 'EXECUTIVE')) {
      quickActions.push({ id: 'approvals', label: 'Approvals', icon: 'check_circle', capability: 'approvals.view' });
      quickActions.push({ id: 'alerts', label: 'Alerts', icon: 'warning', capability: 'alerts.view' });
      quickActions.push({ id: 'broadcast', label: 'Broadcast', icon: 'campaign', capability: 'notifications.broadcast' });
      quickActions.push({ id: 'executive_brief', label: 'Executive Brief', icon: 'analytics', capability: 'reports.view' });
      quickActions.push({ id: 'run_night_audit', label: 'Run Night Audit', icon: 'nightlight_round', capability: 'night_audit.run' });
    }

    // 5. Mock Executive Brief (to be replaced with actual brief logic later)
    const executiveBrief = {
      title: "Today's Executive Brief",
      summary: "Hotel performance is trending positively today. Occupancy is 72%, up 4.2% from yesterday. Two approvals require your decision."
    };

    const authorizedPropertiesDetails = await prisma.property.findMany({
      where: { id: { in: allowedPropertyIds } },
      select: { id: true, name: true, code: true }
    });

    return successResponse({
      generatedAt: new Date().toISOString(),
      scope: {
        property: resolvedPropertyScope,
        availableProperties: authorizedPropertiesDetails
      },
      summary: {
        pendingApprovals: pendingApprovals.length,
        criticalInterventions: criticalInterventions.length
      },
      approvals: pendingApprovals.map((app: any) => ({
        id: app.id,
        type: app.type,
        amount: app.amount ? Number(app.amount) : null,
        currency: app.currency,
        reason: app.reason,
        status: app.status,
        createdAt: app.createdAt,
        requester: {
          name: `${app.requester.firstName} ${app.requester.lastName}`.trim(),
          department: app.requester.department
        },
        property: {
          id: app.property.id,
          name: app.property.name,
          code: app.property.code
        },
        details: app.details
      })),
      interventions: criticalInterventions.map((int: any) => ({
        id: int.id,
        title: int.subject || 'Intervention Required',
        message: int.body,
        priority: int.priority,
        category: int.category,
        createdAt: int.createdAt,
        actionUrl: int.action,
        meta: int.metadata
      })),
      quickActions,
      executiveBrief
    }, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Hub GET]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Unexpected error fetching hub data', 500);
  }
}


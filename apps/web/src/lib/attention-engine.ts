import { prisma } from '@hotel-pms/db';
import { getPropertyBusinessDate } from './kpi';
import { startOfDay } from 'date-fns';

export type AlertPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type AlertCategory = 'CRITICAL' | 'APPROVALS' | 'OPERATIONS' | 'GUESTS' | 'FINANCE';

export interface ManagementAlert {
  id: string; // usually generated uniquely or deterministic (groupKey)
  priority: AlertPriority;
  category: AlertCategory;
  title: string;
  summary: string;
  affectedCount: number;
  propertyId: string;
  action: string;
  createdAt: Date;
}

/**
 * Core Executive Attention Engine
 * Evaluates live conditions across the property to produce normalized management alerts.
 */
export async function evaluatePropertyAlerts(propertyId: string): Promise<ManagementAlert[]> {
  const alerts: ManagementAlert[] = [];
  const now = new Date();
  const businessDate = await getPropertyBusinessDate(propertyId);
  const startOfBizDay = startOfDay(businessDate);

  // 1. Evaluate PENDING APPROVALS
  const pendingApprovals = await prisma.approvalRequest.count({
    where: { propertyId, status: 'PENDING' }
  });

  if (pendingApprovals > 0) {
    alerts.push({
      id: `approval-${propertyId}-pending`,
      priority: 'P1',
      category: 'APPROVALS',
      title: 'Approvals Required',
      summary: `${pendingApprovals} request(s) awaiting your decision`,
      affectedCount: pendingApprovals,
      propertyId,
      action: 'VIEW_APPROVALS',
      createdAt: now,
    });
  }

  // 2. Evaluate MAINTENANCE / OOO
  const outOfOrderRooms = await prisma.roomBlock.findMany({
    where: {
      propertyId,
      type: 'OUT_OF_ORDER',
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: { room: true }
  });

  if (outOfOrderRooms.length >= 3) {
    alerts.push({
      id: `maintenance-${propertyId}-ooo`,
      priority: 'P1',
      category: 'OPERATIONS',
      title: 'High Out-of-Order Rooms',
      summary: `${outOfOrderRooms.length} rooms are currently out of order`,
      affectedCount: outOfOrderRooms.length,
      propertyId,
      action: 'VIEW_MAINTENANCE',
      createdAt: now,
    });
  }

  // 3. Evaluate FINANCE / Outstanding Balances for In-House Guests
  const highBalanceFolios = await prisma.folio.findMany({
    where: {
      propertyId,
      status: 'OPEN',
      reservation: { status: 'CHECKED_IN' },
      balance: { gt: 150000 } // Configurable threshold (e.g. > 150,000 NGN)
    },
    select: { balance: true }
  });

  if (highBalanceFolios.length > 0) {
    const totalExposure = highBalanceFolios.reduce((acc, f) => acc + Number(f.balance), 0);
    
    alerts.push({
      id: `finance-${propertyId}-balance`,
      priority: 'P0',
      category: 'FINANCE',
      title: 'High Outstanding Balances',
      summary: `₦${totalExposure.toLocaleString()} outstanding across ${highBalanceFolios.length} in-house guest(s)`,
      affectedCount: highBalanceFolios.length,
      propertyId,
      action: 'VIEW_FINANCE',
      createdAt: now,
    });
  }

  // 4. Evaluate HOUSEKEEPING
  const dirtyRooms = await prisma.room.count({
    where: {
      propertyId,
      status: 'DIRTY'
    }
  });

  if (dirtyRooms > 10) {
    alerts.push({
      id: `hk-${propertyId}-dirty`,
      priority: 'P2',
      category: 'OPERATIONS',
      title: 'Housekeeping Backlog',
      summary: `${dirtyRooms} rooms currently await cleaning`,
      affectedCount: dirtyRooms,
      propertyId,
      action: 'VIEW_HOUSEKEEPING',
      createdAt: now,
    });
  }

  return alerts.sort((a, b) => {
    // Sort P0 > P1 > P2 > P3
    const pMap: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    return pMap[a.priority] - pMap[b.priority];
  });
}

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

  // 1. Evaluate MANAGER OVERRIDES & APPROVALS (Unusual volume today)
  const todaysApprovals = await prisma.approvalRequest.count({
    where: { 
      propertyId, 
      createdAt: { gte: startOfBizDay }
    }
  });

  // If there's an unusually high number of overrides (e.g., > 5 in a day)
  if (todaysApprovals >= 5) {
    alerts.push({
      id: `approval-${propertyId}-volume`,
      priority: 'P1',
      category: 'APPROVALS',
      title: 'High Volume of Overrides',
      summary: `${todaysApprovals} manager overrides requested today`,
      affectedCount: todaysApprovals,
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

  if (outOfOrderRooms.length > 0) {
    alerts.push({
      id: `maintenance-${propertyId}-ooo`,
      priority: outOfOrderRooms.length >= 3 ? 'P0' : 'P1',
      category: 'OPERATIONS',
      title: 'Rooms Out of Order',
      summary: `${outOfOrderRooms.length} rooms are currently out of order`,
      affectedCount: outOfOrderRooms.length,
      propertyId,
      action: 'VIEW_MAINTENANCE',
      createdAt: now,
    });
  }

  // 3. Evaluate CASHIER VARIANCES
  // Find any frontdesk shifts for today that closed with a non-zero variance
  const frontdeskShifts = await prisma.frontdeskSession.findMany({
    where: {
      propertyId,
      businessDate: { gte: startOfBizDay },
      variance: { not: null, notIn: [0] }
    },
    select: { variance: true }
  });

  const posShifts = await prisma.posSession.findMany({
    where: {
      propertyId,
      businessDate: { gte: startOfBizDay },
      variance: { not: null, notIn: [0] }
    },
    select: { variance: true }
  });

  const totalVarianceShifts = frontdeskShifts.length + posShifts.length;
  if (totalVarianceShifts > 0) {
    let totalVarianceAmt = 0;
    frontdeskShifts.forEach(s => totalVarianceAmt += Math.abs(Number(s.variance || 0)));
    posShifts.forEach(s => totalVarianceAmt += Math.abs(Number(s.variance || 0)));

    alerts.push({
      id: `finance-${propertyId}-variance`,
      priority: 'P0',
      category: 'FINANCE',
      title: 'Cashier Variance Detected',
      summary: `₦${totalVarianceAmt.toLocaleString()} variance across ${totalVarianceShifts} shift(s)`,
      affectedCount: totalVarianceShifts,
      propertyId,
      action: 'VIEW_FINANCE',
      createdAt: now,
    });
  }

  // Note: Sync Health is evaluated directly in the dashboard API

  return alerts.sort((a, b) => {
    // Sort P0 > P1 > P2 > P3
    const pMap: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    return pMap[a.priority] - pMap[b.priority];
  });
}

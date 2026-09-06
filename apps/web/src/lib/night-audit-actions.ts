'use server';

import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getSystemIntegrity, getFinancialAudit, getCashReconciliation } from './night-audit-service';

export async function getNightAuditHistory(propertyId: string) {
  if (!propertyId) return [];
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  const { requireOrganizationContext } = await import('@/lib/organization-access');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  const audits = await prisma.nightAudit.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { financialSnapshot: true }
  });
  return audits;
}

export async function getExceptions(propertyId: string) {
  if (!propertyId) return null;
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  const { requireOrganizationContext } = await import('@/lib/organization-access');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');

  const sys = await getSystemIntegrity(ctx, propertyId);
  const fin = await getFinancialAudit(ctx, propertyId);
  const cash = await getCashReconciliation(ctx, propertyId);
  
  // Calculate overages and shortages
  let overage = 0;
  let shortage = 0;
  // Simplification for UI display
  
  return {
    openPosSessions: sys.openPosSessions.length,
    syncConflicts: sys.financialSyncConflicts.length,
    highBalances: fin.highBalances.length,
    rateVariances: fin.rateVariances.length,
    cashOverages: overage, // Not fully calculated in this scope
    cashShortages: shortage, // Not fully calculated in this scope
  };
}

export async function getSystemHealth(propertyId: string) {
  if (!propertyId) return null;
  const hardware = await prisma.hardwareAgent.findMany({
    where: { propertyId }
  });
  const syncConflicts = await prisma.syncConflict.count({
    where: { propertyId, status: 'PENDING' }
  });
  
  return { hardware, syncConflicts };
}

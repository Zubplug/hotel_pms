'use server';

import prisma from '@hotel-pms/db';
import { getSystemIntegrity, getFinancialAudit, getCashReconciliation } from './night-audit-service';

export async function getNightAuditHistory(propertyId: string) {
  if (!propertyId) return [];
  const audits = await prisma.nightAudit.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  return audits;
}

export async function getExceptions(propertyId: string) {
  if (!propertyId) return null;
  const sys = await getSystemIntegrity(propertyId);
  const fin = await getFinancialAudit(propertyId);
  const cash = await getCashReconciliation(propertyId);
  
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

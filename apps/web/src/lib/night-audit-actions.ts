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

  const userIds = [...new Set(audits.map(a => a.runBy).filter(Boolean))];
  
  const users = await prisma.user.findMany({
    where: { id: { in: userIds as string[] } },
    select: { id: true, staffId: true, email: true }
  });
  
  const staffIds = [...new Set(users.map(u => u.staffId).filter(Boolean))];
  
  const staffs = await prisma.staff.findMany({
    where: { id: { in: staffIds as string[] } },
    select: { id: true, firstName: true, lastName: true }
  });

  const nameMap = new Map();
  for (const user of users) {
    if (user.staffId) {
      const staff = staffs.find(s => s.id === user.staffId);
      if (staff) {
        nameMap.set(user.id, `${staff.firstName} ${staff.lastName}`);
      }
    } else {
      nameMap.set(user.id, user.email.split('@')[0]);
    }
  }

  return audits.map(audit => ({
    ...audit,
    auditorName: audit.runBy ? nameMap.get(audit.runBy) || 'Unknown User' : 'SYSTEM',
  }));
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

export async function getNightAuditRoomCharges(propertyId: string, businessDate: string) {
  if (!propertyId || !businessDate) return [];
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  const { requireOrganizationContext } = await import('@/lib/organization-access');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');

  const charges = await prisma.folioItem.findMany({
    where: {
      folio: { propertyId },
      businessDate: new Date(businessDate),
      source: 'ROOM_CHARGE'
    },
    include: {
      folio: {
        include: {
          reservation: {
            include: {
              reservationRooms: {
                include: { room: true }
              },
              primaryGuest: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return charges.map(charge => {
    const res = charge.folio?.reservation;
    const roomNumber = res?.reservationRooms?.[0]?.room?.number || 'Unassigned';
    const guestName = res?.primaryGuest ? `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}` : 'Unknown Guest';
    
    return {
      id: charge.id,
      amount: Number(charge.amount),
      description: charge.description,
      roomNumber,
      guestName,
      reservationId: res?.id,
    };
  });
}

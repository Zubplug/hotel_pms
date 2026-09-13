'use server';

import { revalidatePath } from 'next/cache';
import { ProcurementService } from '@/lib/inventory/ProcurementService';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { requireOrganizationContext } from '@/lib/organization-access';

// Dummy auth for demo since we don't have full session access in this test execution
// In a real app this would be: import { auth } from '@/lib/auth';
async function getActor(propertyId: string) {
  const prisma = (await import('@hotel-pms/db')).default;
  const property = await prisma.property.findUnique({ where: { id: propertyId }});
  if (!property) throw new Error('Property not found');
  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId: property.organizationId }
  });
  if (!membership) throw new Error('No user found');
  return membership.userId;
}

export async function createPurchaseOrderAction(data: any) {
  try {
    const actorId = await getActor(data.propertyId);
    await ProcurementService.createPO(data, actorId);
    revalidatePath('/fnb/purchasing');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitPurchaseOrderAction(propertyId: string, poId: string) {
  try {
    const actorId = await getActor(propertyId);
    await ProcurementService.submitPO(poId, actorId);
    revalidatePath('/fnb/purchasing');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approvePurchaseOrderAction(propertyId: string, poId: string) {
  try {
    const actorId = await getActor(propertyId);
    await ProcurementService.approvePO(poId, actorId);
    revalidatePath('/fnb/purchasing');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectPurchaseOrderAction(propertyId: string, poId: string, reason: string) {
  try {
    const actorId = await getActor(propertyId);
    await ProcurementService.rejectPO(poId, actorId, reason);
    revalidatePath('/fnb/purchasing');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createAndPostGRNAction(propertyId: string, poId: string, items: any[]) {
  try {
    const actorId = await getActor(propertyId);
    const ctx = await requireOrganizationContext(actorId);

    // 1. Create Draft GRN
    const { grn } = await ProcurementService.createGRN(poId, actorId, items);

    // 2. Approve GRN (Mocking standard managerial approval for demo)
    const prisma = (await import('@hotel-pms/db')).default;
    await prisma.goodsReceivedNote.update({
      where: { id: grn.id },
      data: { status: 'APPROVED' }
    });

    // 3. Post Receipt to Stock (Calculates MAC, creates StockTransaction, updates PO)
    const operationId = `GRN-${grn.grnNumber}-${Date.now()}`;
    await InventoryService.postReceipt(ctx, grn.id, actorId, operationId);

    revalidatePath('/fnb/purchasing');
    revalidatePath('/fnb/purchasing/receiving');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

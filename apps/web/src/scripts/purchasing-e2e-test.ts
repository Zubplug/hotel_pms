import prisma from '@hotel-pms/db';
import { ProcurementService } from '../lib/inventory/ProcurementService';
import { InventoryService } from '../lib/inventory/InventoryService';
import { requireOrganizationContext } from '../lib/organization-access';

async function run() {
  console.log('--- Phase 2B: Purchasing & Receiving E2E Verification ---');

  // 1. Setup Context
  const property = await prisma.property.findFirst({ where: { isActive: true } });
  if (!property) throw new Error('No active property found');

  const adminUser = await prisma.organizationMembership.findFirst({
    where: { organizationId: property.organizationId }
  });
  if (!adminUser) throw new Error('No admin user found');
  const actorId = adminUser.userId;

  const ctx = await requireOrganizationContext(actorId);

  // Ensure property has a business date
  const bizDate = property.businessDate || new Date('2026-09-13');
  await prisma.property.update({ where: { id: property.id }, data: { businessDate: bizDate } });

  // 2. Setup Supplier & Stock Item
  let supplier = await prisma.supplier.findFirst({ where: { propertyId: property.id } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        propertyId: property.id,
        name: 'Test Food Supplier',
        code: 'TEST-SUPP',
        currency: 'NGN'
      }
    });
  }

  const category = await prisma.inventoryCategory.findFirst({ where: { propertyId: property.id } })
    || await prisma.inventoryCategory.create({ data: { propertyId: property.id, name: 'Food', type: 'FOOD' } });

  const warehouse = await prisma.warehouse.findFirst({ where: { propertyId: property.id } })
    || await prisma.warehouse.create({ data: { propertyId: property.id, name: 'Main Store', type: 'MAIN' } });

  const stockItem = await prisma.stockItem.create({
    data: {
      propertyId: property.id,
      name: `Test Tomato ${Date.now()}`,
      sku: `TOM-${Date.now()}`,
      categoryId: category.id,
      warehouseId: warehouse.id,
      baseUnit: 'KG',
      costPrice: 500, // Initial MAC
      quantityOnHand: 10,
      isActive: true,
    }
  });

  console.log(`Starting Stock: ${stockItem.quantityOnHand} @ ${stockItem.costPrice}`);

  // 3. Purchase Order Lifecycle
  const poAmount = 1000;
  const poQty = 20;

  const po = await ProcurementService.createPO({
    propertyId: property.id,
    supplierId: supplier.id,
    items: [{
      stockItemId: stockItem.id,
      description: stockItem.name,
      quantity: poQty,
      unitPrice: poAmount,
      unitOfMeasure: 'KG'
    }]
  }, actorId);
  console.log(`PO Created: ${po.poNumber}`);

  await ProcurementService.submitPO(po.id, actorId);
  await ProcurementService.approvePO(po.id, actorId);
  console.log('PO Approved.');

  // 4. Goods Received Note (Partial Receiving)
  // Ordered 20, Receiving 15 at 1200 each (Higher cost to test MAC)
  const receivedQty = 15;
  const receivedCost = 1200;

  const poItem = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: po.id } });
  const { grn } = await ProcurementService.createGRN(po.id, actorId, [{
    poItemId: poItem!.id,
    receivedQty,
    unitCost: receivedCost
  }]);
  console.log(`GRN Draft Created: ${grn.grnNumber}`);

  // Approve GRN (Mocking standard approval)
  await prisma.goodsReceivedNote.update({
    where: { id: grn.id },
    data: { status: 'APPROVED' }
  });

  // 5. Post Receipt
  const operationId = `E2E-TEST-${Date.now()}`;
  await InventoryService.postReceipt(ctx, grn.id, actorId, operationId);
  console.log('GRN Posted to Stock.');

  // 6. Verification
  const updatedStock = await prisma.stockItem.findUnique({ where: { id: stockItem.id } });
  const updatedPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
  const txRecord = await prisma.stockTransaction.findFirst({ where: { grnId: grn.id } });

  console.log('\n--- VERIFICATION RESULTS ---');
  
  // 6a. Stock & MAC
  // Initial: 10 @ 500 = 5000
  // Received: 15 @ 1200 = 18000
  // Total: 25 @ 23000 -> MAC = 920
  console.log(`Stock Qty: ${updatedStock?.quantityOnHand} (Expected: 25)`);
  console.log(`MAC: ${updatedStock?.costPrice} (Expected: 920)`);
  
  // 6b. PO Status
  console.log(`PO Status: ${updatedPo?.status} (Expected: PARTIALLY_RECEIVED)`);

  // 6c. Business Date Alignment
  const matchesBizDate = txRecord?.businessDate.toISOString() === bizDate.toISOString();
  console.log(`Business Date Alignment: ${matchesBizDate ? '✅ Passed' : '❌ Failed'} (Expected: ${bizDate.toISOString().split('T')[0]}, Got: ${txRecord?.businessDate.toISOString().split('T')[0]})`);

  // 6d. Over-receiving
  try {
    console.log('Attempting over-receive (Receiving 10, when only 5 remain)...');
    const { grn: overGrn } = await ProcurementService.createGRN(po.id, actorId, [{
      poItemId: poItem!.id,
      receivedQty: 10,
      unitCost: 1200
    }]);
    await prisma.goodsReceivedNote.update({ where: { id: overGrn.id }, data: { status: 'APPROVED' } });
    await InventoryService.postReceipt(ctx, overGrn.id, actorId, `E2E-OVER-${Date.now()}`);
    console.log('❌ Failed: Allowed over-receiving!');
  } catch (err: any) {
    if (err.message.includes('Over-receiving is not permitted')) {
      console.log('✅ Passed: Prevented over-receiving.');
    } else if (err.message.includes('Cannot receive 10')) {
      console.log('✅ Passed: Prevented over-receiving at GRN creation.');
    } else {
      console.log(`❌ Failed with unexpected error: ${err.message}`);
    }
  }

  // 6e. Idempotency (Duplicate posting)
  const duplicateRes = await InventoryService.postReceipt(ctx, grn.id, actorId, operationId);
  console.log(`Duplicate GRN Protection: ${duplicateRes.message === 'Already processed' ? '✅ Passed' : '❌ Failed'}`);
}

run().catch(console.error).finally(() => prisma.$disconnect());

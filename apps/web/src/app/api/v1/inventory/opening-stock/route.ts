import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma, { AdjustmentReason, StockTransactionSource, UnitOfMeasure } from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from '@/lib/organization-access';
import { assertNightAuditAllowsTransaction } from '@/lib/night-audit-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'inventory.opening.balance', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const warehouses = await prisma.warehouse.findMany({
      where: { propertyId: { in: ctx.propertyIds as string[] }, posOutletId: null, isActive: true },
      include: { stockItems: { where: { isActive: true }, include: { stockUnits: { orderBy: { unit: 'asc' } } }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ data: warehouses, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'inventory.opening.balance', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const warehouseId = String(body.warehouseId || '');
    const stockItemId = String(body.stockItemId || '');
    const quantity = Number(body.quantity);
    const unitCost = Number(body.unitCost ?? 0);
    const inputUnit = String(body.inputUnit || '');
    const unitsInBase = body.unitsInBase == null || body.unitsInBase === '' ? null : Number(body.unitsInBase);
    const overrideBaseUnit = body.overrideBaseUnit !== false;
    const notes = String(body.notes || '').trim();
    const operationId = String(body.operationId || '').trim();
    if (!warehouseId || !stockItemId || !operationId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      return NextResponse.json({ data: null, error: 'Warehouse, stock item, operation ID, positive quantity, and valid unit cost are required' }, { status: 400 });
    }

    const propertyId = ctx.propertyIds[0];
    await assertNightAuditAllowsTransaction(propertyId);
    const existing = await prisma.stockTransaction.findUnique({ where: { operationId } });
    if (existing) return NextResponse.json({ data: existing, error: null });

    const result = await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, propertyId, posOutletId: null, isActive: true } });
      if (!warehouse) throw new Error('Only an active property main warehouse can receive opening stock.');
      const item = await tx.stockItem.findFirst({ where: { id: stockItemId, propertyId, warehouseId, isActive: true }, include: { stockUnits: true } });
      if (!item) throw new Error('Stock item was not found in the selected main warehouse.');

      if (inputUnit && !Object.values(UnitOfMeasure).includes(inputUnit as UnitOfMeasure)) {
        throw new Error(`Unsupported purchase unit: ${inputUnit}.`);
      }
      if (inputUnit !== item.baseUnit && unitsInBase != null && (!Number.isFinite(unitsInBase) || unitsInBase <= 0)) {
        throw new Error(`Enter a valid conversion for 1 ${inputUnit} in ${item.baseUnit}.`);
      }

      const itemIdentity = item.posProductId
        ? { posProductId: item.posProductId }
        : item.sku
          ? { sku: item.sku }
          : { name: { equals: item.name, mode: 'insensitive' as const } };
      const relatedItems = await tx.stockItem.findMany({
        where: { propertyId, isActive: true, ...itemIdentity },
        include: { stockUnits: true },
      });

      if (overrideBaseUnit && inputUnit !== item.baseUnit) {
        const baseConversion = unitsInBase ?? 0;
        if (!Number.isFinite(baseConversion) || baseConversion <= 0) {
          throw new Error(`Enter how many ${item.baseUnit} make 1 ${inputUnit}.`);
        }
        for (const related of relatedItems) {
          const relatedTransactions = await tx.stockTransaction.findMany({ where: { stockItemId: related.id } });
          for (const transaction of relatedTransactions) {
            await tx.stockTransaction.update({
              where: { id: transaction.id },
              data: {
                quantity: Number(transaction.quantity) / baseConversion,
                quantityBefore: Number(transaction.quantityBefore) / baseConversion,
                quantityAfter: Number(transaction.quantityAfter) / baseConversion,
                unitCost: Number(transaction.unitCost) * baseConversion,
              },
            });
          }
          for (const unit of related.stockUnits) {
            if (unit.unit === inputUnit) {
              await tx.stockItemUnit.delete({ where: { id: unit.id } });
            } else {
              await tx.stockItemUnit.update({
                where: { id: unit.id },
                data: { unitsInBase: Number(unit.unitsInBase) / baseConversion },
              });
            }
          }
          await tx.stockItem.update({
            where: { id: related.id },
            data: {
              baseUnit: inputUnit as UnitOfMeasure,
              quantityOnHand: Number(related.quantityOnHand) / baseConversion,
              costPrice: Number(related.costPrice) * baseConversion,
            },
          });
        }
      }

      if (inputUnit !== item.baseUnit && unitsInBase != null && !overrideBaseUnit) {
        const relatedIds = relatedItems.map((related) => related.id);
        await tx.stockItemUnit.updateMany({
          where: { stockItemId: { in: relatedIds }, isPurchaseUnit: true, unit: { not: inputUnit as UnitOfMeasure } },
          data: { isPurchaseUnit: false },
        });
        for (const relatedId of relatedIds) {
          await tx.stockItemUnit.upsert({
            where: { stockItemId_unit: { stockItemId: relatedId, unit: inputUnit as UnitOfMeasure } },
            create: { stockItemId: relatedId, unit: inputUnit as UnitOfMeasure, unitsInBase, isPurchaseUnit: true },
            update: { unitsInBase, isPurchaseUnit: true },
          });
        }
      }
      const conversion = overrideBaseUnit && inputUnit !== item.baseUnit
        ? 1
        : inputUnit === item.baseUnit
        ? 1
        : unitsInBase != null
          ? unitsInBase
          : Number(item.stockUnits.find((unit) => unit.unit === inputUnit)?.unitsInBase || 0);
      if (!conversion || conversion <= 0) throw new Error(`No conversion is configured from ${inputUnit || 'the selected unit'} to ${item.baseUnit}.`);
      const baseQuantity = quantity * conversion;
      const baseUnitCost = unitCost / conversion;

      const before = overrideBaseUnit && inputUnit !== item.baseUnit
        ? Number(item.quantityOnHand) / Number(unitsInBase)
        : Number(item.quantityOnHand);
      const existingValue = before * (overrideBaseUnit && inputUnit !== item.baseUnit
        ? Number(item.costPrice) * Number(unitsInBase)
        : Number(item.costPrice));
      const incomingValue = baseQuantity * baseUnitCost;
      const after = before + baseQuantity;
      const weightedCost = after > 0 ? (existingValue + incomingValue) / after : baseUnitCost;
      const updated = await tx.stockItem.update({
        where: { id: item.id },
        data: { quantityOnHand: { increment: baseQuantity }, costPrice: weightedCost },
      });
      return tx.stockTransaction.create({
        data: {
          propertyId,
          stockItemId: item.id,
          warehouseId,
          source: StockTransactionSource.ADJUSTMENT,
          reason: AdjustmentReason.OPENING_BALANCE,
          quantity: baseQuantity,
          unitCost: baseUnitCost,
          quantityBefore: before,
          quantityAfter: Number(updated.quantityOnHand),
          totalValue: incomingValue,
          currency: 'NGN',
          operationId,
          userId,
          reference: `OPENING_BALANCE:${item.id}`,
          notes: `${notes || 'Legacy stock opening balance'} · Entered as ${quantity} ${inputUnit} at NGN ${unitCost} per ${inputUnit}; converted to ${baseQuantity} ${item.baseUnit}`,
          businessDate: new Date(),
        },
      });
    });
    return NextResponse.json({ data: result, error: null }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

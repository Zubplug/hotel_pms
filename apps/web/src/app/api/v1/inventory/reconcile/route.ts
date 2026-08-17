import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { propertyId, stockItemId, physicalCount, reason, notes, userId } = body;

    if (!propertyId || !stockItemId || physicalCount === undefined || !reason || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.findUnique({
        where: { id: stockItemId }
      });

      if (!stockItem) {
        throw new Error('StockItem not found');
      }

      const systemQuantity = Number(stockItem.quantityOnHand);
      const variance = physicalCount - systemQuantity;

      if (variance === 0) {
        return { message: 'No variance to adjust' };
      }

      // Generate a deterministic operationId or use UUID
      const operationId = `adj_${crypto.randomUUID()}`;

      // Create Adjustment Transaction
      const transaction = await tx.stockTransaction.create({
        data: {
          propertyId,
          stockItemId,
          source: 'ADJUSTMENT',
          quantity: variance,
          unitCost: stockItem.costPrice,
          reference: 'PHYSICAL_COUNT',
          notes: notes || 'Physical inventory reconciliation',
          reason: reason,
          businessDate: new Date(),
          operationId: operationId,
          userId: userId,
          approvalId: userId // Assuming auto-approval for authorized users in Phase 1.2
        }
      });

      // Update StockItem balance
      await tx.stockItem.update({
        where: { id: stockItemId },
        data: { quantityOnHand: physicalCount }
      });

      // Resolve related Negative Stock Alert if balance is now >= 0
      if (physicalCount >= 0) {
        await tx.inventoryAlert.updateMany({
          where: {
            stockItemId,
            status: 'OPEN',
            type: 'NEGATIVE_STOCK'
          },
          data: {
            status: 'RESOLVED',
            resolvedBy: userId,
            resolvedAt: new Date()
          }
        });
      }

      return { transaction, variance };
    });

    return NextResponse.json({ status: 'SUCCESS', data: result }, { status: 200 });
  } catch (error: any) {
    console.error('Inventory reconcile error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

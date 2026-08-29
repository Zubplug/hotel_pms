import prisma from '@hotel-pms/db';

export class InventoryAlertService {
  static async sync(propertyId: string) {
    const items = await prisma.stockItem.findMany({
      where: { propertyId, isActive: true },
      select: { id: true, name: true, quantityOnHand: true, reorderLevel: true, warehouse: { select: { name: true } } },
    });

    const activeConditions = new Map<string, { type: string; message: string }>();
    for (const item of items) {
      const quantity = Number(item.quantityOnHand);
      const reorderLevel = item.reorderLevel === null ? null : Number(item.reorderLevel);
      if (quantity < 0) {
        activeConditions.set(`${item.id}:NEGATIVE_STOCK`, {
          type: 'NEGATIVE_STOCK',
          message: `${item.name} is below zero (${quantity}) in ${item.warehouse.name}.`,
        });
      } else if (quantity === 0) {
        activeConditions.set(`${item.id}:NEGATIVE_STOCK`, {
          type: 'NEGATIVE_STOCK',
          message: `${item.name} is out of stock in ${item.warehouse.name}.`,
        });
      }
      if (reorderLevel !== null && quantity > 0 && quantity <= reorderLevel) {
        activeConditions.set(`${item.id}:REORDER_LEVEL`, {
          type: 'REORDER_LEVEL',
          message: `${item.name} is at ${quantity}; reorder level is ${reorderLevel}.`,
        });
      }
    }

    const existing = await prisma.inventoryAlert.findMany({ where: { propertyId } });
    await prisma.$transaction(async (tx) => {
      for (const [key, condition] of activeConditions) {
        const [stockItemId] = key.split(':');
        const current = existing.find(alert => alert.stockItemId === stockItemId && alert.type === condition.type);
        if (!current) {
          await tx.inventoryAlert.create({ data: { propertyId, stockItemId, type: condition.type, message: condition.message } });
        } else if (current.status === 'RESOLVED') {
          await tx.inventoryAlert.update({ where: { id: current.id }, data: { status: 'OPEN', message: condition.message, resolvedBy: null, resolvedAt: null } });
        } else if (current.message !== condition.message) {
          await tx.inventoryAlert.update({ where: { id: current.id }, data: { message: condition.message } });
        }
      }

      for (const alert of existing) {
        if (!activeConditions.has(`${alert.stockItemId}:${alert.type}`) && alert.status !== 'RESOLVED') {
          await tx.inventoryAlert.update({ where: { id: alert.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
        }
      }
    });
  }
}

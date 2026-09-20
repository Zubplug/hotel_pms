import { prisma } from '@hotel-pms/db';

export class InventoryService {
  static async getInventoryValuation(propertyId: string) {
    const items = await prisma.stockItem.findMany({
      where: { propertyId },
      include: { inventoryCategory: true, warehouse: true }
    });

    const rows = items.map(item => {
      const quantity = Number(item.quantityOnHand);
      const unitCost = Number(item.costPrice || 0);
      return {
        category: item.inventoryCategory?.name || 'Uncategorized',
        department: item.warehouse?.name || 'General',
        sku: item.sku || '-',
        name: item.name,
        quantity,
        unitCost,
        totalValue: quantity * unitCost
      };
    });

    return {
      rows,
      summary: {
        category: '',
        department: '',
        sku: 'TOTAL',
        name: 'Total Inventory Value',
        quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
        unitCost: 0,
        totalValue: rows.reduce((sum, row) => sum + row.totalValue, 0)
      }
    };
  }

  static async getCostOfSales(propertyId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.stockTransaction.findMany({
      where: {
        propertyId,
        source: { in: ['SALE', 'WASTE'] },
        businessDate: { gte: startDate, lte: endDate }
      },
      include: { stockItem: { include: { inventoryCategory: true, warehouse: true } } }
    });

    const rowsMap = new Map<string, {
      category: string;
      department: string;
      name: string;
      usageQty: number;
      wasteQty: number;
      costOfSales: number;
    }>();

    for (const transaction of transactions) {
      if (!rowsMap.has(transaction.stockItemId)) {
        rowsMap.set(transaction.stockItemId, {
          category: transaction.stockItem.inventoryCategory?.name || 'Uncategorized',
          department: transaction.stockItem.warehouse?.name || 'General',
          name: transaction.stockItem.name,
          usageQty: 0,
          wasteQty: 0,
          costOfSales: 0
        });
      }

      const row = rowsMap.get(transaction.stockItemId)!;
      const quantity = Math.abs(Number(transaction.quantity));
      const unitCost = Number(transaction.unitCost || transaction.stockItem.costPrice || 0);
      if (transaction.source === 'SALE') row.usageQty += quantity;
      if (transaction.source === 'WASTE') row.wasteQty += quantity;
      row.costOfSales += quantity * unitCost;
    }

    const rows = [...rowsMap.values()].sort((a, b) => a.category.localeCompare(b.category));
    return {
      rows,
      summary: {
        category: '',
        department: '',
        name: 'TOTAL COST OF SALES',
        usageQty: rows.reduce((sum, row) => sum + row.usageQty, 0),
        wasteQty: rows.reduce((sum, row) => sum + row.wasteQty, 0),
        costOfSales: rows.reduce((sum, row) => sum + row.costOfSales, 0)
      }
    };
  }
}

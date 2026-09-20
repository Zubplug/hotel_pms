import { prisma } from '@hotel-pms/db';

export class InventoryService {
  /**
   * Generates the Inventory Valuation report showing the value of all StockItems.
   */
  static async getInventoryValuation(propertyId: string) {
    const items = await prisma.stockItem.findMany({
      where: { propertyId },
      include: { category: true, department: true }
    });

    const rows = items.map(item => {
      const qty = Number(item.quantityOnHand);
      const cost = Number(item.averageCost || item.lastCost || 0);
      return {
        category: item.category?.name || 'Uncategorized',
        department: item.department?.name || 'General',
        sku: item.sku || '-',
        name: item.name,
        quantity: qty,
        unitCost: cost,
        totalValue: qty * cost
      };
    });

    return {
      rows,
      summary: {
        category: '',
        department: '',
        sku: 'TOTAL',
        name: 'Total Inventory Value',
        quantity: rows.reduce((s, r) => s + r.quantity, 0),
        unitCost: 0,
        totalValue: rows.reduce((s, r) => s + r.totalValue, 0)
      }
    };
  }

  /**
   * Generates the Cost of Sales report by aggregating StockTransactions of type ISSUE/USAGE or sales.
   */
  static async getCostOfSales(propertyId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.stockTransaction.findMany({
      where: {
        propertyId,
        type: { in: ['USAGE', 'WASTE', 'SALE'] }, // Assuming these types indicate consumption
        date: { gte: startDate, lte: endDate }
      },
      include: { item: { include: { category: true, department: true } } }
    });

    const rowsMap = new Map<string, any>();

    for (const tx of transactions) {
      if (!rowsMap.has(tx.itemId)) {
        rowsMap.set(tx.itemId, {
          category: tx.item.category?.name || 'Uncategorized',
          department: tx.item.department?.name || 'General',
          name: tx.item.name,
          usageQty: 0,
          wasteQty: 0,
          costOfSales: 0
        });
      }

      const row = rowsMap.get(tx.itemId);
      const qty = Number(tx.quantity);
      const cost = Number(tx.unitCost || tx.item.averageCost || 0);

      if (tx.type === 'USAGE' || tx.type === 'SALE') {
        row.usageQty += Math.abs(qty); // Usually usage is recorded as negative
        row.costOfSales += Math.abs(qty) * cost;
      } else if (tx.type === 'WASTE') {
        row.wasteQty += Math.abs(qty);
        row.costOfSales += Math.abs(qty) * cost; // Often included in COGS or isolated
      }
    }

    const rows = Array.from(rowsMap.values()).sort((a, b) => a.category.localeCompare(b.category));

    return {
      rows,
      summary: {
        category: '',
        department: '',
        name: 'TOTAL COST OF SALES',
        usageQty: rows.reduce((s, r) => s + r.usageQty, 0),
        wasteQty: rows.reduce((s, r) => s + r.wasteQty, 0),
        costOfSales: rows.reduce((s, r) => s + r.costOfSales, 0)
      }
    };
  }
}

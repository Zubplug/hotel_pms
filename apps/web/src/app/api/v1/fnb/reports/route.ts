import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const requestedPropertyId = searchParams.get('propertyId');
    const outletId = searchParams.get('outletId');
    const warehouseId = searchParams.get('warehouseId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const allowedPropertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;

    if (requestedPropertyId && !allowedPropertyIds.includes(requestedPropertyId) && !(session.user as any).isSuperAdmin) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const propertyIdsToQuery = requestedPropertyId ? [requestedPropertyId] : allowedPropertyIds;
    
    // Determine Date Range
    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      // Default to current property business date
      const property = await prisma.property.findUnique({
        where: { id: propertyIdsToQuery[0] },
        select: { businessDate: true }
      });
      const now = new Date();
      startDate = property?.businessDate || new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = startDate;
    }

    // 1. Fetch Orders within range (excluding CANCELLED/VOIDED from Gross unless properly accounted)
    // The user explicitly stated: "Every transaction is included exactly once in the DSS."
    // We fetch all orders that are NOT CLOSED/CANCELLED without payment? Wait, standard is to fetch SUBMITTED, IN_SERVICE, BILLED, PAID, PARTIALLY_PAID.
    // Actually, let's just fetch all orders that are NOT CANCELLED/VOIDED, plus any voids that we specifically want to track.
    // If an order is VOIDED/CANCELLED but has no payment, it's not revenue.
    const orders = await prisma.posOrder.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] },
        ...(outletId ? { outletId } : {}),
        businessDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'VOIDED'] }
      },
      include: {
        serverStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true, position: true },
        },
        outlet: { select: { name: true } },
        session: {
          select: { id: true, status: true, controlStatus: true, openedAt: true, closedAt: true },
        },
        payments: {
          where: { status: { notIn: ['FAILED', 'REFUNDED', 'VOIDED'] } },
          select: { method: true, amount: true },
        },
        voids: { select: { id: true } },
        items: {
          include: {
            product: {
              include: {
                category: true,
                recipe: {
                  include: {
                    versions: {
                      where: { isActive: true },
                      include: { ingredients: { include: { stockItem: true } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Waiter-level shift summary. The report intentionally derives this from
    // the same posted POS orders used by the DSS, so totals reconcile to the
    // selected property/outlet/date scope without introducing a second source
    // of truth or synthetic shift data.
    type WaiterShiftAccumulator = {
      staffId: string | null;
      name: string;
      employeeId: string | null;
      position: string | null;
      totalChecks: number;
      closedChecks: number;
      openChecks: number;
      covers: number;
      grossSales: number;
      discounts: number;
      netSales: number;
      guestCharge: number;
      tips: number;
      voids: number;
      outletNames: Set<string>;
      sessionIds: Set<string>;
      sessionStatuses: Set<string>;
      tenders: Record<string, number>;
    };

    const waiterMap = new Map<string, WaiterShiftAccumulator>();
    for (const order of orders) {
      const key = order.serverStaffId || 'unassigned';
      const current = waiterMap.get(key) || {
        staffId: order.serverStaff?.id || null,
        name: order.serverStaff ? `${order.serverStaff.firstName} ${order.serverStaff.lastName}`.trim() : 'Unassigned waiter',
        employeeId: order.serverStaff?.employeeId || null,
        position: order.serverStaff?.position || null,
        totalChecks: 0,
        closedChecks: 0,
        openChecks: 0,
        covers: 0,
        grossSales: 0,
        discounts: 0,
        netSales: 0,
        guestCharge: 0,
        tips: 0,
        voids: 0,
        outletNames: new Set<string>(),
        sessionIds: new Set<string>(),
        sessionStatuses: new Set<string>(),
        tenders: {},
      };

      const gross = Number(order.subtotal || 0);
      const discount = Number(order.discount || 0);
      current.totalChecks += 1;
      current.closedChecks += order.status === 'CLOSED' ? 1 : 0;
      current.openChecks += order.status === 'CLOSED' ? 0 : 1;
      current.covers += Number(order.guestCount || 1);
      current.grossSales += gross;
      current.discounts += discount;
      current.netSales += Math.max(0, gross - discount);
      current.guestCharge += Number(order.total || 0);
      current.tips += Number(order.tipAmount || 0);
      current.voids += order.voids?.length || 0;
      if (order.outlet?.name) current.outletNames.add(order.outlet.name);
      if (order.session?.id) {
        current.sessionIds.add(order.session.id);
        current.sessionStatuses.add(order.session.controlStatus || order.session.status);
      }
      for (const payment of order.payments || []) {
        current.tenders[payment.method] = (current.tenders[payment.method] || 0) + Number(payment.amount || 0);
      }
      waiterMap.set(key, current);
    }

    const waiterShiftSummary = Array.from(waiterMap.values())
      .map((waiter) => ({
        staffId: waiter.staffId,
        name: waiter.name,
        employeeId: waiter.employeeId,
        position: waiter.position,
        totalChecks: waiter.totalChecks,
        closedChecks: waiter.closedChecks,
        openChecks: waiter.openChecks,
        covers: waiter.covers,
        grossSales: waiter.grossSales,
        discounts: waiter.discounts,
        netSales: waiter.netSales,
        guestCharge: waiter.guestCharge,
        averageCheck: waiter.closedChecks > 0 ? waiter.netSales / waiter.closedChecks : 0,
        spendPerCover: waiter.covers > 0 ? waiter.netSales / waiter.covers : 0,
        tips: waiter.tips,
        voids: waiter.voids,
        outletNames: Array.from(waiter.outletNames),
        shiftCount: waiter.sessionIds.size,
        shiftStatuses: Array.from(waiter.sessionStatuses),
        tenders: Object.entries(waiter.tenders).map(([method, amount]) => ({ method, amount })),
      }))
      .sort((a, b) => b.netSales - a.netSales);

    // 2. Fetch Payments for the period
    const paymentsAgg = await prisma.posPayment.groupBy({
      by: ['method'],
      where: {
        order: {
          propertyId: { in: propertyIdsToQuery as string[] },
          ...(outletId ? { outletId } : {}),
          businessDate: { gte: startDate, lte: endDate }
        },
        status: { notIn: ['FAILED', 'REFUNDED'] }
      },
      _sum: { amount: true }
    });

    // 3. Fetch Stock Transactions for the Inventory Reconciliation
    // Only fetch if warehouseId is provided or if outlet has a primary warehouse
    let stockMovement: any[] = [];
    if (warehouseId) {
      const stockItems = await prisma.stockItem.findMany({
        where: { warehouseId }
      });

      const transactions = await prisma.stockTransaction.findMany({
        where: {
          warehouseId,
          businessDate: { gte: startDate, lte: endDate }
        },
        orderBy: { timestamp: 'asc' }
      });

      // We also need opening stock. The user stated:
      // "Opening = quantityAfter of the latest transaction before period start"
      const prevTransactions = await prisma.stockTransaction.findMany({
        where: {
          warehouseId,
          businessDate: { lt: startDate }
        },
        orderBy: { timestamp: 'desc' },
        distinct: ['stockItemId']
      });

      const prevTxMap = new Map(prevTransactions.map(tx => [tx.stockItemId, tx]));

      stockMovement = stockItems.map(item => {
        const itemTxs = transactions.filter(t => t.stockItemId === item.id);
        const lastPrevTx = prevTxMap.get(item.id);
        
        let opening = lastPrevTx ? Number(lastPrevTx.quantityAfter) : Number(item.quantityOnHand); // Fallback to current if no history
        
        if (itemTxs.length > 0) {
           // Better fallback: if we have tx in the period, the opening is the quantityBefore of the first tx
           opening = Number(itemTxs[0].quantityBefore);
        } else if (lastPrevTx) {
           opening = Number(lastPrevTx.quantityAfter);
        }

        let receipts = 0;
        let transferIn = 0;
        let transferOut = 0;
        let sales = 0;
        let waste = 0;
        let adjustments = 0;
        let returned = 0;

        for (const tx of itemTxs) {
          const qty = Number(tx.quantity);
          switch(tx.source) {
            case 'RECEIPT': receipts += qty; break;
            case 'TRANSFER':
              // Assuming positive is transfer IN, negative is transfer OUT
              if (qty > 0) transferIn += qty;
              else transferOut += Math.abs(qty);
              break;
            case 'SALE': sales += Math.abs(qty); break;
            case 'WASTE': waste += Math.abs(qty); break;
            case 'ADJUSTMENT': adjustments += qty; break; // +/-
            case 'POS_VOID':
            case 'POS_REFUND':
            case 'RETURN':
              returned += Math.abs(qty); break;
          }
        }

        const expectedClosing = opening + receipts + transferIn - transferOut - sales - waste + adjustments + returned;
        const actualClosing = itemTxs.length > 0 ? Number(itemTxs[itemTxs.length - 1].quantityAfter) : opening;

        return {
          stockItemId: item.id,
          name: item.name,
          sku: item.sku,
          unitOfMeasure: item.baseUnit,
          opening,
          receipts,
          transferIn,
          transferOut,
          sales,
          waste,
          adjustments,
          returned,
          expectedClosing,
          actualClosing,
          variance: actualClosing - expectedClosing
        };
      });
    }

    // 4. Calculate Sales, Allowances, COGS
    let foodGross = 0;
    let bevGross = 0;
    let otherGross = 0;
    
    let foodDiscounts = 0;
    let bevDiscounts = 0;
    let otherDiscounts = 0;

    let totalTax = 0;
    let totalServiceCharge = 0;

    let theoreticalCogs = 0;

    let totalCovers = 0;
    const totalChecks = orders.length;

    for (const order of orders) {
      totalCovers += order.guestCount || 1;
      totalTax += Number(order.taxAmount || 0);
      totalServiceCharge += Number(order.serviceCharge || 0);
      
      for (const item of order.items) {
        // Exclude voided items from gross if they exist in a submitted order
        if (item.kitchenStatus === 'VOIDED') continue;

        const fnbClass = item.product?.category?.fnbClass || 'OTHER';
        const persistedSubtotal = Number(item.subtotal || 0);
        const itemGross = persistedSubtotal > 0
          ? persistedSubtotal
          : Number(item.quantity || 0) * Number(item.unitPrice || 0);
        const itemDiscount = Number(item.discount || 0);

        if (fnbClass === 'FOOD') {
          foodGross += itemGross;
          foodDiscounts += itemDiscount;
        } else if (fnbClass === 'BEVERAGE') {
          bevGross += itemGross;
          bevDiscounts += itemDiscount;
        } else {
          otherGross += itemGross;
          otherDiscounts += itemDiscount;
        }

        // Calculate Theoretical COGS
        const activeRecipe = item.product?.recipe?.versions?.[0];
        if (activeRecipe) {
          let itemCost = 0;
          for (const ing of activeRecipe.ingredients) {
            itemCost += Number(ing.quantity) * Number(ing.stockItem?.costPrice || 0);
          }
          theoreticalCogs += itemCost * Number(item.quantity);
        }
      }
      
      // If the order has order-level discounts not distributed to items, we need to account for them.
      // Usually, subtotal - discount = total. The item-level discount should sum to order-level discount.
      // We will trust the item-level aggregation for departmental breakdown.
    }

    const grossRevenue = foodGross + bevGross + otherGross;
    const totalDiscounts = foodDiscounts + bevDiscounts + otherDiscounts;
    // For voids, we strictly use the POS_VOID stock transactions or explicitly marked voided items.
    // The user said: "Do not double count voids". If an item is voided, it's not in gross revenue.
    // So "Void Allowances" here is purely informative, representing revenue that *was* rung up but voided.
    // Let's fetch voided items for the period to show as "Allowances/Voids" but NOT deduct from Net since they aren't in Gross.
    const voidedOrders = await prisma.posOrder.findMany({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] },
        ...(outletId ? { outletId } : {}),
        businessDate: { gte: startDate, lte: endDate },
        status: { in: ['CANCELLED', 'VOIDED'] }
      },
      select: { subtotal: true }
    });
    const totalVoids = voidedOrders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
    
    // Calculate Actual COGS from StockTransactions(SALE)
    const saleTransactions = await prisma.stockTransaction.aggregate({
      where: {
        propertyId: { in: propertyIdsToQuery as string[] },
        ...(warehouseId ? { warehouseId } : {}),
        businessDate: { gte: startDate, lte: endDate },
        source: 'SALE'
      },
      _sum: { totalValue: true }
    });
    // totalValue is quantity * unitCost. Because quantity is negative for SALE, we use absolute.
    const actualCogs = Math.abs(Number(saleTransactions._sum?.totalValue || 0));

    const netRevenue = grossRevenue - totalDiscounts; // Tax is already excluded from subtotal in LodgeCore
    const totalGuestCharge = netRevenue + totalTax + totalServiceCharge;

    const spendPerCover = totalCovers > 0 ? netRevenue / totalCovers : 0;
    const averageCheck = totalChecks > 0 ? netRevenue / totalChecks : 0;

    return successResponse({
      reports: {
        dateRange: { start: startDate, end: endDate },
        summary: {
          foodGross,
          bevGross,
          otherGross,
          grossRevenue,
          foodDiscounts,
          bevDiscounts,
          otherDiscounts,
          totalDiscounts,
          totalVoids,
          netRevenue,
          totalTax,
          totalServiceCharge,
          totalGuestCharge,
        },
        statistics: {
          totalCovers,
          totalChecks,
          spendPerCover,
          averageCheck
        },
        profitability: {
          actualCogs,
          theoreticalCogs,
          grossProfit: netRevenue - actualCogs,
          grossMarginPct: netRevenue > 0 ? ((netRevenue - actualCogs) / netRevenue) * 100 : 0,
          actualCostPct: netRevenue > 0 ? (actualCogs / netRevenue) * 100 : 0,
          theoreticalCostPct: netRevenue > 0 ? (theoreticalCogs / netRevenue) * 100 : 0,
          cogsVariance: actualCogs - theoreticalCogs
        },
        tenderBreakdown: paymentsAgg.map(p => ({ method: p.method, amount: Number(p._sum.amount || 0) })),
        waiterShiftSummary,
        inventoryMovement: stockMovement
      }
    }, 200);
  } catch (err: any) {
    console.error('[FNB Reports GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching DSS reports', 500);
  }
}

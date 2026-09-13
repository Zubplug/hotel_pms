import prisma from '@hotel-pms/db';

async function run() {
  console.log('--- F&B Revenue Audit ---');
  
  const property = await prisma.property.findFirst({ where: { isActive: true } });
  if (!property) throw new Error('No active property');

  const bizDate = property.businessDate || new Date('2026-09-13');
  console.log(`Auditing Business Date: ${bizDate.toISOString().split('T')[0]}`);

  // Fetch all orders for this business date
  const orders = await prisma.posOrder.findMany({
    where: { propertyId: property.id },
    include: {
      items: {
        include: {
          product: { include: { category: true } }
        }
      },
      payments: true,
      voids: true,
      discounts: true,
      outlet: true
    }
  });

  console.log(`Found ${orders.length} PosOrder records.`);

  let totalGross = 0;
  let totalDiscounts = 0;
  let totalNet = 0;
  let voidedSubtotals = 0;
  let paymentSums = { PAID: 0, REFUNDED: 0, UNVERIFIED: 0 };
  let itemsCount = 0;

  for (const o of orders) {
    if (o.status === 'VOIDED') {
      voidedSubtotals += Number(o.subtotal);
      continue;
    }
    
    totalGross += Number(o.subtotal);
    totalDiscounts += Number(o.discount);
    totalNet += Number(o.total);

    for (const item of o.items) {
      if (!item.voidReason) {
        itemsCount += Number(item.quantity);
      }
    }

    for (const p of o.payments) {
      if (p.status === 'PAID') paymentSums.PAID += Number(p.amount);
      if (p.status === 'REFUNDED') paymentSums.REFUNDED += Number(p.amount);
    }
  }

  console.log('--- Summary Aggregates (Audit calculation) ---');
  console.log(`Total Gross (excl voids): NGN ${totalGross}`);
  console.log(`Total Net (excl voids, incl discounts): NGN ${totalNet}`);
  console.log(`Total Discounts: NGN ${totalDiscounts}`);
  console.log(`Voided Order Subtotals: NGN ${voidedSubtotals}`);
  console.log(`Total Non-Void Items Sold: ${itemsCount}`);
  
  console.log('--- Payment Statuses ---');
  console.log(paymentSums);

  console.log('\n--- Sample Order details ---');
  if (orders.length > 0) {
    const o = orders.find(x => x.status !== 'VOIDED') || orders[0];
    console.log(`Order ${o.orderNumber}:`);
    console.log(` - Subtotal: ${o.subtotal}`);
    console.log(` - Discount: ${o.discount}`);
    console.log(` - Total: ${o.total}`);
    console.log(` - Payment Status: ${o.paymentStatus}`);
    if (o.items.length > 0) {
      console.log(` - Item 0 class: ${o.items[0].product?.category?.fnbClass}`);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());

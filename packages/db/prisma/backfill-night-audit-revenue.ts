import prisma from '../index';

type AuditWithSnapshot = Awaited<ReturnType<typeof loadAudits>>[number];

async function loadAudits() {
  return prisma.nightAudit.findMany({
    where: { status: 'COMPLETED', financialSnapshot: { isNot: null } },
    orderBy: [{ propertyId: 'asc' }, { businessDate: 'asc' }],
    include: { financialSnapshot: true },
  });
}

async function recalculate(audit: AuditWithSnapshot) {
  const [folioItems, posOrders] = await Promise.all([
    prisma.folioItem.findMany({
      where: {
        folio: { propertyId: audit.propertyId },
        businessDate: audit.businessDate,
        voidedAt: null,
      },
      select: {
        amount: true,
        type: true,
        source: true,
        revenueCategory: true,
        posTransactionId: true,
      },
    }),
    prisma.posOrder.findMany({
      where: {
        propertyId: audit.propertyId,
        businessDate: audit.businessDate,
        status: 'CLOSED',
        paymentStatus: 'PAID',
      },
      select: {
        id: true,
        total: true,
        payments: {
          where: { status: 'CONFIRMED' },
          select: { amount: true, method: true },
        },
      },
    }),
  ]);

  let roomRevenue = 0;
  let fnbRevenue = 0;
  let otherRevenue = 0;
  let taxes = 0;
  let discounts = 0;
  let refunds = 0;

  for (const item of folioItems) {
    const amount = Number(item.amount || 0);

    if (item.type === 'CHARGE') {
      if (item.source === 'ROOM_CHARGE' || item.revenueCategory === 'ROOM') {
        roomRevenue += amount;
      } else if (item.source === 'POS' || item.revenueCategory === 'FNB') {
        fnbRevenue += amount;
      } else if (item.revenueCategory === 'OTHER') {
        otherRevenue += amount;
      } else if (item.revenueCategory === 'TAX') {
        taxes += amount;
      }
    } else if (item.type === 'TAX') {
      taxes += amount;
    } else if (item.type === 'DISCOUNT' || item.type === 'COMPLIMENTARY') {
      discounts += Math.abs(amount);
    } else if (item.type === 'REFUND') {
      refunds += amount;
    }
  }

  // A POS order may either be posted to a guest folio or settled directly at
  // the outlet. Count direct settlements here, but never count a POS order
  // twice when its folio charge is already present above.
  const representedPosOrderIds = new Set(
    folioItems
      .filter((item) => item.type === 'CHARGE' && item.source === 'POS' && item.posTransactionId)
      .map((item) => item.posTransactionId as string),
  );

  for (const order of posOrders) {
    if (representedPosOrderIds.has(order.id)) continue;
    const complimentary = order.payments
      .filter((payment) => String(payment.method).toUpperCase() === 'COMPLIMENTARY')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    fnbRevenue += Math.max(0, Number(order.total) - complimentary);
  }

  const grossRevenue = roomRevenue + fnbRevenue + otherRevenue;
  const netRevenue = grossRevenue - discounts - refunds;

  return {
    roomRevenue,
    fnbRevenue,
    otherRevenue,
    taxes,
    discounts,
    refunds,
    grossRevenue,
    netRevenue,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const audits = await loadAudits();
  let changed = 0;

  for (const audit of audits) {
    const next = await recalculate(audit);
    const current = audit.financialSnapshot;
    if (!current) continue;

    const differs = [
      ['roomRevenue', current.roomRevenue, next.roomRevenue],
      ['fnbRevenue', current.fnbRevenue, next.fnbRevenue],
      ['otherRevenue', current.otherRevenue, next.otherRevenue],
      ['taxes', current.taxes, next.taxes],
      ['discounts', current.discounts, next.discounts],
      ['refunds', current.refunds, next.refunds],
      ['grossRevenue', current.grossRevenue, next.grossRevenue],
      ['netRevenue', current.netRevenue, next.netRevenue],
    ].some(([, before, after]) => Number(before) !== Number(after));

    if (!differs) continue;
    changed++;
    console.log(`${audit.propertyId} ${audit.businessDate.toISOString().slice(0, 10)}:`, next);

    if (apply) {
      await prisma.$transaction([
        prisma.nightAuditFinancialSnapshot.update({
          where: { nightAuditId: audit.id },
          data: next,
        }),
        prisma.nightAudit.update({
          where: { id: audit.id },
          data: {
            totalRoomRevenue: next.roomRevenue,
            totalRevenue: next.grossRevenue,
          },
        }),
      ]);
    }
  }

  console.log(`${apply ? 'Applied' : 'Found'} ${changed} historical audit correction(s).`);
  if (!apply && changed > 0) {
    console.log('Run again with --apply to update these completed snapshots.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

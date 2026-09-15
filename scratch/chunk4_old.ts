    propertyId,
    businessDate,
  }));
  const balanceProofRows = balanceRows.map(({ propertyId: _propertyId, businessDate: _businessDate, ...row }) => row);
  const balanceProofStatus = balanceProofRows.every((row) => row.status === 'PROVEN') ? 'PROVEN' : balanceProofRows.some((row) => row.status === 'HAS_VARIANCE') ? 'HAS_VARIANCE' : 'INCOMPLETE';
  const [paymentMethodTotals, unresolvedExceptionCount, latePostingCount, voidCount, adjustmentCount, cashTotals] = await Promise.all([
    prisma.payment.groupBy({ by: ['method'], where: { propertyId, businessDate, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true }, _count: { id: true } }),
    prisma.transactionException.count({ where: { propertyId, businessDate, status: { in: ['OPEN', 'PENDING_APPROVAL'] } } }),
    prisma.folioItem.count({ where: { folio: { propertyId }, businessDate, isLatePosting: true, voidedAt: null } }),
    prisma.folioItem.count({ where: { folio: { propertyId }, businessDate, voidedAt: { not: null } } }),
    prisma.folioItem.count({ where: { folio: { propertyId }, businessDate, type: 'ADJUSTMENT', voidedAt: null } }),
    prisma.posSession.aggregate({ where: { propertyId, businessDate }, _sum: { expectedCash: true, actualCash: true, variance: true } }),
  ]);
  const paymentTotals = paymentMethodTotals.map((row) => ({ method: row.method, amount: Number(row._sum.amount || 0), count: row._count.id }));
  const snapshotReconciliationStatus = balanceProofStatus === 'PROVEN' && journalPosting.status === 'POSTED' && unresolvedExceptionCount === 0 && !hasDepartmentVariance ? 'RECONCILED' : 'HAS_EXCEPTIONS';
  if (hasDepartmentVariance || balanceProofStatus !== 'PROVEN') errors++;
  const closeSourceTotals = {
    roomRevenue: roomRevenueVal,
    fnbRevenue: fnbRevenueVal,
    otherRevenue: schemaOtherRevenue,
    taxes: taxesVal,
    discounts: discountsVal,
    refunds: refundsVal,
    grossRevenue: grossRevenueVal,
    netRevenue: netRevenueVal,
    paymentTotals,
    cashExpected: Number(cashTotals._sum.expectedCash || 0),
    cashDeclared: Number(cashTotals._sum.actualCash || 0),
    cashVariance: Number(cashTotals._sum.variance || 0),
    unresolvedExceptionCount,
    latePostingCount,
    voidCount,
    adjustmentCount,
  };
  const closeBalanceProof = {
    status: balanceProofStatus,
    reason: 'Account-level balance rows are preserved with the close package; unavailable ledgers remain explicitly marked.',
    ledgers: balanceProofRows,
    journal: { postedEntryCount: postedJournals.length, status: journalPosting.status, missingAccounts: journalPosting.missingAccounts },
  };
  const closeControlSummary = {
    errors,
    roomChargesPosted: totalRoomChargesPosted,
    tasksCreated: totalTasksCreated,
    tasksSkipped: totalTasksSkipped,
    occupancy,
    adr,
    revpar,
    journalPosting,
    balanceProofStatus,
    departmentReconciliation,
  };
  const closeReportManifest = [
    'managers-flash', 'detailed-revenue', 'trial-balance', 'cashier-summary',
    'payment-method-reconciliation', 'tax-summary', 'guest-ledger', 'city-ledger',
    'no-show', 'room-status', 'voids-and-adjustments', 'discounts-and-complimentary',
    'refunds', 'late-postings', 'pos-settlement', 'exception-register',
    'audit-acknowledgements', 'final-gl-journal',
  ].map((key) => ({ key, auditId: auditRun.id, businessDate: businessDate.toISOString() }));
  const closePackageHash = crypto.createHash('sha256').update(JSON.stringify({
    runReference,
    businessDate: businessDate.toISOString(),
    closeSourceTotals,
    closeBalanceProof,
    closeControlSummary,
    closeReportManifest,
    journalEntryIds: postedJournals.map((entry) => entry.id),
    journalPosting,
    departmentReconciliation,
  })).digest('hex');

  // Final atomic commit — NightAudit completion, property status, occupancy snapshot,
  // and audit log all succeed together or all roll back.
  
  const roomStatusCounts = await prisma.room.groupBy({
    by: ['status'],
    where: { propertyId },
    _count: { status: true }
  });
  const outOfOrderRooms = roomStatusCounts.find((r: any) => r.status === 'OUT_OF_ORDER')?._count?.status ?? 0;
  const blockedRooms = roomStatusCounts.find((r: any) => r.status === 'BLOCKED')?._count?.status ?? 0;

  const [completedAudit] = await prisma.$transaction([
    // 1. Mark NightAudit COMPLETED
    prisma.nightAudit.update({
      where: { id: auditRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        tasksCreated: { increment: totalTasksCreated },
        tasksSkipped: { increment: totalTasksSkipped },
        roomChargesPosted: { increment: totalRoomChargesPosted },
        errors: { increment: errors },
        totalRoomRevenue,
        totalRevenue: totalRevenueValue,
        occupancy,
        adr,
        revpar,
      }
    }),
    // 2. Create NightAuditFinancialSnapshot
    prisma.nightAuditFinancialSnapshot.create({
      data: {
        nightAuditId: auditRun.id,
        roomRevenue: roomRevenueVal,
        fnbRevenue: fnbRevenueVal,
        otherRevenue: schemaOtherRevenue,
        taxes: taxesVal,
        discounts: discountsVal,
        refunds: refundsVal,
        grossRevenue: grossRevenueVal,
        netRevenue: netRevenueVal,
        paymentTotals,
        cashExpected: Number(cashTotals._sum.expectedCash || 0),
        cashDeclared: Number(cashTotals._sum.actualCash || 0),
        cashVariance: Number(cashTotals._sum.variance || 0),
        unresolvedExceptionCount,
        latePostingCount,
        voidCount,
        adjustmentCount,
        journalEntryIds: postedJournals.map((entry) => entry.id),
        reconciliationStatus: snapshotReconciliationStatus,
        snapshotHash: closePackageHash,
        finalizedAt: new Date(),
      }
    }),
    prisma.nightAuditClosePackage.create({
      data: {
        nightAuditId: auditRun.id,
        propertyId,
        businessDate,
        status: errors > 0 || (grossRevenueVal > 0 && postedJournals.length === 0)
          ? 'COMPLETED_WITH_EXCEPTIONS'
          : 'COMPLETED',
        sourceTotals: closeSourceTotals,
        balanceProof: closeBalanceProof,
        controlSummary: closeControlSummary,
        reportManifest: closeReportManifest,
        journalEntryIds: postedJournals.map((entry) => entry.id),
        packageHash: closePackageHash,
        createdBy: userId,
        finalizedAt: new Date(),
        accountBalances: { create: balanceRows },
      },
    }),
    // 3. Update property audit status
    prisma.property.update({
      where: { id: propertyId },
      data: {
        // The business date is part of the success commit. A failed posting,
        // journal, snapshot, or close-package write therefore leaves the
        // property on the date that still needs to be audited.
        businessDate: nextBusinessDate,
        lastAuditAt: new Date(),
        auditStatus: errors > 0 ? 'COMPLETED_WITH_EXCEPTIONS' : 'COMPLETED'
      }
    }),
    // 4. Snapshot occupancy — atomic with audit completion for KPI reporting consistency.
    //    If this fails, the audit is NOT marked COMPLETED, preventing a phantom 'done' state.
    prisma.occupancySnapshot.upsert({
      where: { propertyId_businessDate: { propertyId, businessDate } },
      create: {
        propertyId,
        businessDate,
        totalRooms: roomCount,
        occupiedRooms: occupiedCount,
        availableRooms: roomCount - occupiedCount,
        outOfOrderRooms,
        blockedRooms,
        occupancyPct: occupancy,
        adr,
        revpar,
        currency: property.supportedCurrencies?.[0] || 'NGN',
      },
      update: { occupancyPct: occupancy, adr, revpar, totalRooms: roomCount, occupiedRooms: occupiedCount, outOfOrderRooms, blockedRooms }
    }),
    // 5. Audit log — atomic so it cannot say 'COMPLETED' if the update rolled back
    prisma.auditLog.create({
      data: {
        organizationId: property.organizationId,
        propertyId,
        userId,
        userEmail: userEmail || 'unknown@system.local',
        userRole,
        action: 'NIGHT_AUDIT_COMPLETED',
        resource: 'NightAudit',
        resourceId: auditRun.id,
        newValue: {
          tasksCreated: totalTasksCreated,
          chargesPosted: totalRoomChargesPosted,
          phase: 'COMPLETED',
          businessDate,
          nextBusinessDate,
          occupancy,
          totalRoomRevenue,
        },
        ipAddress: reqIp,
        userAgent: reqUserAgent,
        requestId: crypto.randomUUID(),
      }
    }),
    // 6. Publish Hotel Activity Event for Night Audit Completion
    prisma.hotelActivityEvent.create({
      data: {
        propertyId,
        businessDate,
        occurredAt: new Date(),
        category: 'NIGHT_AUDIT',
        eventType: 'NIGHT_AUDIT_COMPLETED',
        actorId,
        actorName: 'SYSTEM',
        title: `Night Audit Completed for ${businessDate.toISOString().split('T')[0]}`,
        description: `Successfully closed business date. Gross Revenue: ${grossRevenueVal.toLocaleString()}.`,
        severity: 'INFO',
        metadata: {
          auditId: auditRun.id,
          tasksCreated: totalTasksCreated,
          errors
        }
      }
    })
  ]);

  const [completedAudit, finalErrors] = await prisma.$transaction(async (tx) => {
    let txErrors = errors;
    
    // 1. Post Accounting Journal inside transaction
    const journalPosting = await postNightAuditJournal(tx, {
      propertyId,
      businessDate: journalBusinessDate,
      auditId: auditRun.id,
      createdBy: userId,
    });
    if (journalPosting.status !== 'POSTED') {
      txErrors++;
      console.error('[Night Audit] Accounting journal was not posted:', journalPosting);
      throw new Error(`BLOCKER:Night Audit cannot close without a posted accounting journal (${journalPosting.status}).`);
    }

    // 2. Fetch posted journals for balance proof and close package
    const postedJournals = await tx.journalEntry.findMany({
      where: { propertyId, nightAuditId: auditRun.id, status: 'POSTED' },
      select: { id: true },
    });
    const journalLines = postedJournals.length ? await tx.journalEntryLine.findMany({
      where: { entryId: { in: postedJournals.map((entry) => entry.id) } },
      select: { debit: true, credit: true, account: { select: { code: true } } },
    }) : [];
    
    const glCredit = (code: string) => journalLines.filter((line) => line.account.code === code).reduce((sum, line) => sum + Number(line.credit), 0);
    const departmentReconciliation = [
      { department: 'Rooms', source: roomRevenueVal, gl: glCredit('4050') },
      { department: 'F&B/POS', source: fnbRevenueVal, gl: glCredit('4250') },
      { department: 'Recreation/Pool', source: poolRevenueVal, gl: glCredit('4100') },
      { department: 'Other', source: otherRevenueVal, gl: glCredit('4400') },
      { department: 'Taxes', source: taxesVal, gl: glCredit('2200') },
      { department: 'Service Charge', source: serviceChargeVal, gl: glCredit('2210') },
    ].map((row) => ({ ...row, difference: row.source - row.gl, status: Math.abs(row.source - row.gl) < 0.01 ? 'MATCHED' : 'VARIANCE' }));
    
    const hasDepartmentVariance = departmentReconciliation.some((row) => row.status === 'VARIANCE');
    
    // 3. Build Balance Proof inside transaction
    const balanceRows = (await buildNightAuditBalanceProof(tx, { propertyId, businessDate })).map((row) => ({
      ...row,
      propertyId,
      businessDate,
    }));
    const balanceProofRows = balanceRows.map(({ propertyId: _propertyId, businessDate: _businessDate, ...row }) => row);
    const balanceProofStatus = balanceProofRows.every((row) => row.status === 'PROVEN') ? 'PROVEN' : balanceProofRows.some((row) => row.status === 'HAS_VARIANCE') ? 'HAS_VARIANCE' : 'INCOMPLETE';
    
    // 4. Aggregations (now using tx)
    const [paymentMethodTotals, unresolvedExceptionCount, latePostingCount, voidCount, adjustmentCount, cashTotals] = await Promise.all([
      tx.payment.groupBy({ by: ['method'], where: { propertyId, businessDate, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true }, _count: { id: true } }),
      tx.transactionException.count({ where: { propertyId, businessDate, status: { in: ['OPEN', 'PENDING_APPROVAL'] } } }),
      tx.folioItem.count({ where: { folio: { propertyId }, businessDate, isLatePosting: true, voidedAt: null } }),
      tx.folioItem.count({ where: { folio: { propertyId }, businessDate, voidedAt: { not: null } } }),
      tx.folioItem.count({ where: { folio: { propertyId }, businessDate, type: 'ADJUSTMENT', voidedAt: null } }),
      tx.posSession.aggregate({ where: { propertyId, businessDate }, _sum: { expectedCash: true, actualCash: true, variance: true } }),
    ]);
    const paymentTotals = paymentMethodTotals.map((row) => ({ method: row.method, amount: Number(row._sum.amount || 0), count: row._count.id }));
    const snapshotReconciliationStatus = balanceProofStatus === 'PROVEN' && journalPosting.status === 'POSTED' && unresolvedExceptionCount === 0 && !hasDepartmentVariance ? 'RECONCILED' : 'HAS_EXCEPTIONS';
    
    if (hasDepartmentVariance || balanceProofStatus !== 'PROVEN') txErrors++;
    
    // 5. Finalize Close Package Payload
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
      errors: txErrors,
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

    // 6. DB Updates (all atomic in tx)
    const runUpdate = await tx.nightAudit.update({
      where: { id: auditRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        tasksCreated: { increment: totalTasksCreated },
        tasksSkipped: { increment: totalTasksSkipped },
        roomChargesPosted: { increment: totalRoomChargesPosted },
        errors: { increment: txErrors },
        totalRoomRevenue,
        totalRevenue: totalRevenueValue,
        occupancy,
        adr,
        revpar,
      }
    });

    await tx.nightAuditFinancialSnapshot.create({
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
    });

    await tx.nightAuditClosePackage.create({
      data: {
        nightAuditId: auditRun.id,
        propertyId,
        businessDate,
        status: txErrors > 0 || (grossRevenueVal > 0 && postedJournals.length === 0)
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
    });

    await tx.property.update({
      where: { id: propertyId },
      data: {
        businessDate: nextBusinessDate,
        lastAuditAt: new Date(),
        auditStatus: txErrors > 0 ? 'COMPLETED_WITH_EXCEPTIONS' : 'COMPLETED'
      }
    });

    await tx.occupancySnapshot.upsert({
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
    });

    await tx.auditLog.create({
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
    });

    await tx.hotelActivityEvent.create({
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
          errors: txErrors
        }
      }
    });

    return [runUpdate, txErrors];
  });
  
  errors = finalErrors;

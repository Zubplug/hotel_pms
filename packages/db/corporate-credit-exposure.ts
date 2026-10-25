type CorporateCreditExposureInput = {
  corporateAccountId: string;
  propertyId: string;
  additionalAmount?: number;
  excludeReservationId?: string;
};

type CorporateCreditExposure = {
  corporateAccountId: string;
  cityLedgerAccountId: string;
  creditLimit: number;
  exemptFromHighBalance: boolean;
  ledgerBalance: number;
  openFolioExposure: number;
  committedReservationExposure: number;
  currentExposure: number;
  projectedExposure: number;
};

/**
 * Reads the single corporate credit exposure policy used by online and
 * offline server boundaries. Approval does not post anything; this only
 * calculates whether a new commitment or charge is permitted.
 */
export async function readCorporateCreditExposure(
  tx: any,
  input: CorporateCreditExposureInput,
): Promise<CorporateCreditExposure> {
  const account = await tx.corporateAccount.findFirst({
    where: { id: input.corporateAccountId, propertyId: input.propertyId, isActive: true },
    select: {
      id: true,
      creditLimit: true,
      exemptFromHighBalance: true,
      cityLedgerAccountId: true,
      cityLedgerAccount: { select: { status: true, balance: true } },
    },
  });

  if (!account?.cityLedgerAccountId || account.cityLedgerAccount?.status !== 'ACTIVE') {
    throw new Error('CORPORATE_LEDGER_NOT_AVAILABLE');
  }

  // Serialize all credit decisions for this corporate ledger account so
  // concurrent API bookings, approvals, Night Audit, and replayed offline
  // charge events cannot validate the same stale balance.
  await tx.$queryRaw<any[]>`
    SELECT id
    FROM "CityLedgerAccount"
    WHERE id = ${account.cityLedgerAccountId}::uuid
    FOR UPDATE
  `;

  const openFolios = await tx.folio.findMany({
    where: { propertyId: input.propertyId, corporateAccountId: input.corporateAccountId, type: 'CITY_LEDGER', status: 'OPEN' },
    select: { balance: true },
  });
  const openFolioExposure = openFolios.reduce(
    (sum: number, folio: { balance: unknown }) => sum + Math.max(0, Number(folio.balance || 0)),
    0,
  );

  // Confirmed future pay-later reservations are commitments. Checked-in
  // reservations are represented by their live folio exposure instead, which
  // prevents counting both the original quote and posted room charges.
  const committedReservations = await tx.reservation.findMany({
    where: {
      corporateAccountId: input.corporateAccountId,
      propertyId: input.propertyId,
      status: 'CONFIRMED',
      ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
    },
    select: { ratePlanSnapshot: true },
  });
  const committedReservationExposure = committedReservations.reduce((sum: number, reservation: any) => {
    const snapshot = reservation.ratePlanSnapshot as any;
    const paymentMode = String(snapshot?.paymentMode || snapshot?.request?.paymentMode || '').toUpperCase();
    return paymentMode === 'PAY_LATER'
      ? sum + Number(snapshot?.total ?? snapshot?.totals?.total ?? 0)
      : sum;
  }, 0);

  const ledgerBalance = Math.max(0, Number(account.cityLedgerAccount.balance || 0));
  const currentExposure = ledgerBalance + openFolioExposure + committedReservationExposure;
  const projectedExposure = currentExposure + Math.max(0, Number(input.additionalAmount || 0));

  return {
    corporateAccountId: account.id,
    cityLedgerAccountId: account.cityLedgerAccountId,
    creditLimit: Number(account.creditLimit || 0),
    exemptFromHighBalance: account.exemptFromHighBalance,
    ledgerBalance,
    openFolioExposure,
    committedReservationExposure,
    currentExposure,
    projectedExposure,
  };
}

export async function assertCorporateCreditAvailable(
  tx: any,
  input: CorporateCreditExposureInput,
) {
  const exposure = await readCorporateCreditExposure(tx, input);
  if (exposure.creditLimit > 0 && !exposure.exemptFromHighBalance && exposure.projectedExposure > exposure.creditLimit + 0.01) {
    throw new Error('CREDIT_LIMIT_EXCEEDED');
  }
  return exposure;
}

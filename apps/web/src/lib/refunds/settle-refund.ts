/**
 * Applies the accounting side of a refund. Reduced-stay refunds are special:
 * the unused room nights must be voided as charges, otherwise reducing the
 * payment creates a new balance due on the folio.
 */
export async function applyRefundToFolio(
  tx: any,
  request: { id: string; category: string; folioId: string; amount?: unknown; supportingNotes?: string | null },
  amount: number,
  actorId: string,
) {
  let reversedCharges = 0;

  if (request.category === 'REDUCED_STAY') {
    const nightsMatch = request.supportingNotes?.match(/(?:^|\n)Reduced stay nights:\s*(\d+)/i);
    const nights = Number(nightsMatch?.[1] || 0);
    if (!Number.isInteger(nights) || nights <= 0) throw new Error('REDUCED_STAY_METADATA_MISSING');

    const charges = await tx.folioItem.findMany({
      where: { folioId: request.folioId, type: 'CHARGE', source: 'ROOM_CHARGE', voidedAt: null },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
      take: nights,
    });
    if (charges.length !== nights) throw new Error('REDUCED_STAY_CHARGES_UNAVAILABLE');
    reversedCharges = charges.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    if (!Number.isFinite(reversedCharges) || Math.abs(reversedCharges - amount) > 0.01) {
      throw new Error('REDUCED_STAY_CHARGES_CHANGED');
    }

    await tx.folioItem.updateMany({
      where: { id: { in: charges.map((item: any) => item.id) }, voidedAt: null },
      data: { voidedAt: new Date(), voidedBy: actorId, voidReason: `Reduced-stay refund ${request.id}` },
    });
  }

  const folio = await tx.folio.findUnique({ where: { id: request.folioId } });
  if (!folio) throw new Error('NOT_FOUND');
  const updated = await tx.folio.updateMany({
    where: { id: folio.id, version: folio.version },
    data: {
      version: { increment: 1 },
      totalCharges: { decrement: reversedCharges },
      totalPayments: { decrement: amount },
      balance: { increment: amount - reversedCharges },
    },
  });
  if (updated.count !== 1) throw new Error('CONFLICT');
  return { reversedCharges };
}

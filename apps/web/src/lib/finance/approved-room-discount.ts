type DiscountRoom = {
  discountType?: string | null;
  discountAmount?: unknown;
  discountPercent?: unknown;
  discountApprovalId?: string | null;
};

/** Resolve only discounts that have an approved manager/auditor request. */
export async function getApprovedRoomDiscount(tx: any, room: DiscountRoom, grossAmount: number) {
  if (grossAmount <= 0 || !room.discountType || !room.discountApprovalId) return 0;
  const approval = await tx.approvalRequest.findUnique({
    where: { id: room.discountApprovalId.replace(/^PENDING:/, '') },
    select: { status: true },
  });
  if (approval?.status !== 'APPROVED') return 0;
  if (room.discountType === 'FIXED_AMOUNT') return Math.min(grossAmount, Number(room.discountAmount || 0));
  if (room.discountType === 'PERCENTAGE') return Math.min(grossAmount, grossAmount * Number(room.discountPercent || 0) / 100);
  if (room.discountType === 'COMPLIMENTARY') {
    const requested = Number(room.discountAmount || 0);
    return requested > 0 ? Math.min(grossAmount, requested) : grossAmount;
  }
  return 0;
}

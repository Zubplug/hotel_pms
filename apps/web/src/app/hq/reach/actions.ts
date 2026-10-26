'use server';

import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { revalidatePath } from 'next/cache';

export async function setReachProgramEnabled(formData: FormData) {
  await requireHQAdmin();
  const programId = String(formData.get('programId') || '');
  const enabled = String(formData.get('enabled')) === 'true';
  if (!programId) return;

  await prisma.referralProgram.update({
    where: { id: programId },
    data: enabled
      ? { enabled: true, activatedAt: new Date(), pausedAt: null }
      : { enabled: false, pausedAt: new Date() },
  });
  revalidatePath('/hq/reach');
}

export async function updateReachProgramSettings(formData: FormData) {
  await requireHQAdmin();
  const programId = String(formData.get('programId') || '');
  const platformFeePercent = Number(formData.get('platformFeePercent'));
  const platformFeeCap = String(formData.get('platformFeeCap') || '').trim();
  const minimumPayout = Number(formData.get('minimumPayout'));
  const debtSuspensionThreshold = Number(formData.get('debtSuspensionThreshold'));
  const attributionWindowDays = Number(formData.get('attributionWindowDays'));
  const activationFeeAmount = Number(formData.get('activationFeeAmount'));
  const walletAutoApply = formData.getAll('walletAutoApply').some((value) => String(value) === 'true');

  if (!programId || !Number.isFinite(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) return;
  if (!Number.isFinite(minimumPayout) || minimumPayout < 0 || !Number.isFinite(debtSuspensionThreshold) || debtSuspensionThreshold < 0) return;
  if (!Number.isInteger(attributionWindowDays) || attributionWindowDays < 1 || attributionWindowDays > 365) return;
  if (!Number.isFinite(activationFeeAmount) || activationFeeAmount < 0) return;
  if (platformFeeCap && (!Number.isFinite(Number(platformFeeCap)) || Number(platformFeeCap) < 0)) return;

  await prisma.referralProgram.update({
    where: { id: programId },
    data: {
      platformFeeBps: Math.round(platformFeePercent * 100),
      platformFeeCap: platformFeeCap ? Number(platformFeeCap) : null,
      minimumPayout,
      debtSuspensionThreshold,
      attributionWindowDays,
      activationFeeAmount,
      walletAutoApply,
    },
  });
  revalidatePath('/hq/reach');
}

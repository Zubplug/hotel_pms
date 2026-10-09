'use server';

import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

type Result = { ok: true } | { ok: false; error: string };

export async function startCustomWebsiteRequest(id: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    await prisma.customWebsiteRequest.updateMany({ where: { id, status: 'PAID' }, data: { status: 'IN_PROGRESS', activatedAt: new Date(), reviewedBy: admin.email } });
    revalidatePath('/hq/custom-websites');
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Project start failed' }; }
}

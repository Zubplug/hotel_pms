import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';

export async function GET() {
  await requireHQAdmin();
  const leads = await prisma.salesLead.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { organization: { select: { id: true, name: true, slug: true } } } });
  return NextResponse.json({ leads });
}


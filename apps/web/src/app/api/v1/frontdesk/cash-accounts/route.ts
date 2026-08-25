import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const propertyId = new URL(req.url).searchParams.get('propertyId') || (session.user as any).propertyId;
  if (!propertyId) return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
  const accounts = await prisma.cashAccount.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, type: true, balance: true } });
  return NextResponse.json({ data: accounts.map(account => ({ ...account, balance: Number(account.balance) })) });
}

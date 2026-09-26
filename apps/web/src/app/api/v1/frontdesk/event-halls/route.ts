import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  const propertyId = req.nextUrl.searchParams.get('propertyId') || session?.user?.propertyId;
  if (!propertyId) return NextResponse.json({ error: 'Property is required.' }, { status: 400 });
  const halls = await prisma.hall.findMany({ where: { propertyId, isActive: true }, select: { id: true, name: true, code: true, capacity: true }, orderBy: { name: 'asc' } });
  return NextResponse.json({ success: true, data: halls });
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

const CATEGORIES = ['CRITICAL', 'APPROVALS', 'OPERATIONS', 'REPORTS'];

export async function GET() {
  try {
    const context = await HrAuthorizationService.resolveAuthContext();
    const preferences = await prisma.userNotificationPreference.findMany({ where: { userId: context.userId }, orderBy: { category: 'asc' } });
    return NextResponse.json({ preferences });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Unable to load preferences' }, { status: error.message?.includes('Unauthorized') ? 401 : 500 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext();
    const body = await req.json();
    if (!CATEGORIES.includes(String(body.category)) || typeof body.email !== 'boolean' || typeof body.inApp !== 'boolean') return NextResponse.json({ error: 'Category and notification channels are required' }, { status: 400 });
    const preference = await prisma.userNotificationPreference.upsert({ where: { userId_category: { userId: context.userId, category: String(body.category) } }, update: { email: body.email, inApp: body.inApp, push: body.push !== false }, create: { userId: context.userId, category: String(body.category), email: body.email, inApp: body.inApp, push: body.push !== false } });
    return NextResponse.json({ success: true, preference });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Unable to update preferences' }, { status: error.message?.includes('Unauthorized') ? 401 : 500 }); }
}

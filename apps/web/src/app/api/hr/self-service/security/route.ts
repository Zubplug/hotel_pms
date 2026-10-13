import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const { currentPassword, newPassword } = await req.json();
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Current password and a new password of at least 8 characters are required' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { passwordHash: true } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: context.userId }, data: { passwordHash, sessionVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null } });
    return NextResponse.json({ success: true, message: 'Password changed. Please sign in again.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to change password' }, { status: error.message?.includes('Unauthorized') ? 401 : 500 });
  }
}

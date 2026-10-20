import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import prisma from '@hotel-pms/db';
import { requirePortalAdmin } from '@/lib/portal-authorization';
import { sendEmployeeInvitationEmail } from '@/lib/email/send-employee-invitation';

export async function POST(request: NextRequest, context: { params: Promise<{ staffId: string }> }) {
  try {
    const { userId, organizationId } = await requirePortalAdmin();
    const { staffId } = await context.params;
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async tx => {
      const staff = await tx.staff.findFirst({ where: { id: staffId, organizationId, position: 'General Manager', isActive: true, deletedAt: null }, include: { user: true } });
      if (!staff || !staff.user) throw new Error('General Manager account not found.');
      await tx.employeeInvitation.updateMany({ where: { staffId: staff.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } });
      await tx.employeeInvitation.create({ data: { staffId: staff.id, userId: staff.user.id, organizationId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt, invitedById: userId } });
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
      return { email: staff.email, employeeName: `${staff.firstName} ${staff.lastName}`, organizationName: organization?.name || 'LodgeCore' };
    });
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBSITE_URL || request.nextUrl.origin;
    try {
      await sendEmployeeInvitationEmail({ to: result.email, inviteUrl: `${appOrigin}/employee/invite/${token}`, expiresAt, employeeName: result.employeeName, organizationName: result.organizationName });
      return NextResponse.json({ ok: true, invitationSent: true, invitationExpiresAt: expiresAt });
    } catch (emailError) {
      console.error('[portal.general-manager.resend.email]', emailError);
      return NextResponse.json({ ok: true, invitationSent: false, invitationExpiresAt: expiresAt, invitationWarning: emailError instanceof Error ? emailError.message : 'Unable to send the activation email.' });
    }
  } catch (error) {
    console.error('[portal.general-manager.resend]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to resend invitation.' }, { status: 400 });
  }
}

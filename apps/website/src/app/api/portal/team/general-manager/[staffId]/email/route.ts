import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@hotel-pms/db';
import prisma from '@hotel-pms/db';
import { z } from 'zod';
import { requirePortalAdmin } from '@/lib/portal-authorization';
import { sendEmployeeInvitationEmail } from '@/lib/email/send-employee-invitation';

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ staffId: string }> }) {
  try {
    const { userId, organizationId } = await requirePortalAdmin();
    const { staffId } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

    const email = parsed.data.email.toLowerCase();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async tx => {
      const staff = await tx.staff.findFirst({ where: { id: staffId, organizationId, position: { in: ['Property Administrator', 'General Manager'] }, isActive: true, deletedAt: null }, select: { id: true, userId: true, firstName: true, lastName: true, email: true } });
      if (!staff?.userId) throw new Error('Property administrator account not found.');
      const invitation = await tx.employeeInvitation.findFirst({ where: { staffId: staff.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (!invitation) throw new Error('Email can only be changed while the invitation is pending.');
      const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true, staffId: true } });
      if (existingUser && existingUser.id !== staff.userId) throw new Error('This email already belongs to another account.');
      const existingStaff = await tx.staff.findUnique({ where: { email }, select: { id: true } });
      if (existingStaff && existingStaff.id !== staff.id) throw new Error('This email already belongs to another employee account.');
      await tx.user.update({ where: { id: staff.userId }, data: { email } });
      await tx.staff.update({ where: { id: staff.id }, data: { email } });
      await tx.employeeInvitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date() } });
      await tx.employeeInvitation.create({ data: { staffId: staff.id, userId: staff.userId, organizationId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt, invitedById: userId } });
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
      return { employeeName: `${staff.firstName} ${staff.lastName}`, organizationName: organization?.name || 'LodgeCore' };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const appOrigin = process.env.PMS_APP_URL || process.env.NEXT_PUBLIC_PMS_URL || 'https://lodgecore.vercel.app';
    try {
      await sendEmployeeInvitationEmail({ to: email, inviteUrl: `${appOrigin}/employee/invite/${token}`, expiresAt, employeeName: result.employeeName, organizationName: result.organizationName, roleTitle: 'Property Administrator' });
      return NextResponse.json({ ok: true, invitationSent: true, invitationExpiresAt: expiresAt });
    } catch (emailError) {
      console.error('[portal.property-admin.email-update]', emailError);
      return NextResponse.json({ ok: true, invitationSent: false, invitationExpiresAt: expiresAt, invitationWarning: emailError instanceof Error ? emailError.message : 'Unable to send the activation email.' });
    }
  } catch (error) {
    console.error('[portal.property-admin.email-update]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update the email address.' }, { status: 400 });
  }
}

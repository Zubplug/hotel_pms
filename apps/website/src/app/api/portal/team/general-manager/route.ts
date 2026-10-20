import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma, { getEffectiveLimit } from '@hotel-pms/db';
import { requirePortalAdmin } from '@/lib/portal-authorization';
import { sendEmployeeInvitationEmail } from '@/lib/email/send-employee-invitation';

const schema = z.object({ firstName: z.string().trim().min(1).max(60), middleName: z.string().trim().max(60).optional().or(z.literal('')), lastName: z.string().trim().min(1).max(60), email: z.string().trim().email().max(254), phone: z.string().trim().max(30).optional().or(z.literal('')), propertyIds: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requirePortalAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Complete the property administrator details and select at least one property.' }, { status: 400 });
    const properties = await prisma.property.findMany({ where: { organizationId, id: { in: parsed.data.propertyIds }, isActive: true }, select: { id: true } });
    if (properties.length !== parsed.data.propertyIds.length) return NextResponse.json({ error: 'One or more selected properties are not in your organization.' }, { status: 400 });
    const limit = await getEffectiveLimit(prisma, { organizationId, limit: 'maxUsers' });
    const currentUsers = await prisma.staff.count({ where: { organizationId, isActive: true, deletedAt: null } });
    if (limit !== null && currentUsers + 1 > limit) return NextResponse.json({ error: `Your subscription allows ${limit} users. Upgrade your plan to add another team member.` }, { status: 402 });
    const email = parsed.data.email.toLowerCase();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { email }, include: { membership: true } });
      if (existing?.membership && existing.membership.organizationId !== organizationId) throw new Error('This email already belongs to another organization.');
      if (existing?.staffId) throw new Error('This email already belongs to an employee account.');
      const user = existing || await tx.user.create({ data: { email, firstName: parsed.data.firstName, middleName: parsed.data.middleName || null, lastName: parsed.data.lastName, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) } });
      const staff = await tx.staff.create({ data: { organizationId, userId: user.id, employeeId: `EMP-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, email, firstName: parsed.data.firstName, lastName: parsed.data.lastName, phone: parsed.data.phone || null, department: 'Administration', position: 'Property Administrator', propertyAccess: properties.map(property => property.id), isActive: true, hiredAt: new Date() } });
      await tx.user.update({ where: { id: user.id }, data: { staffId: staff.id } });
      await tx.organizationMembership.upsert({ where: { userId: user.id }, update: { organizationId, status: 'ACTIVE', role: 'MEMBER' }, create: { userId: user.id, organizationId, status: 'ACTIVE', role: 'MEMBER' } });
      let role = await tx.role.findFirst({ where: { organizationId, name: 'SUPER_ADMIN' } });
      if (!role) {
        const templates = await tx.role.findMany({ where: { name: 'SUPER_ADMIN' }, include: { permissions: true } });
        const template = templates.sort((a, b) => b.permissions.length - a.permissions.length)[0];
        role = await tx.role.create({ data: { organizationId, name: 'SUPER_ADMIN', description: 'Property-scoped administration', isSystem: false } });
        if (template?.permissions.length) await tx.rolePermission.createMany({ data: template.permissions.map(permission => ({ roleId: role!.id, permissionId: permission.permissionId })) });
      }
      await tx.userRole.deleteMany({ where: { userId: user.id, roleId: role.id } });
      await tx.userRole.createMany({ data: properties.map(property => ({ userId: user.id, roleId: role!.id, propertyId: property.id, grantedBy: userId })) });
      await tx.employeeInvitation.create({ data: { staffId: staff.id, userId: user.id, organizationId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt, invitedById: userId } });
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
      return { staff, organizationName: organization?.name || 'LodgeCore' };
    });
    const appOrigin = process.env.PMS_APP_URL || process.env.NEXT_PUBLIC_PMS_URL || 'https://lodgecore.vercel.app';
    let invitationSent = true;
    let invitationWarning: string | undefined;
    try { await sendEmployeeInvitationEmail({ to: email, inviteUrl: `${appOrigin}/employee/invite/${token}`, expiresAt, employeeName: `${parsed.data.firstName} ${parsed.data.lastName}`, organizationName: result.organizationName, roleTitle: 'Property Administrator' }); }
    catch (emailError) { invitationSent = false; invitationWarning = emailError instanceof Error ? emailError.message : 'Unable to send the activation email.'; console.error('[portal.property-admin.email]', emailError); }
    return NextResponse.json({ ok: true, staffId: result.staff.id, invitationExpiresAt: expiresAt, invitationSent, invitationWarning });
  } catch (error) {
    console.error('[portal.general-manager.create]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create property administrator account.' }, { status: 400 });
  }
}

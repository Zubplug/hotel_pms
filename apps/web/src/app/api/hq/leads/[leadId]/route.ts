import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { sendCustomerInvitationEmail } from '@/lib/email/send-customer-invitation';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'customer';
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const admin = await requireHQAdmin();
  const leadId = (await params).leadId;
  const body = await request.json().catch(() => ({}));
  const action = body.action === 'QUALIFY' ? 'QUALIFY' : body.action === 'CONVERT' ? 'CONVERT' : null;
  if (!action) return NextResponse.json({ error: 'Action must be QUALIFY or CONVERT' }, { status: 400 });
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (action === 'QUALIFY') {
    const updated = await prisma.salesLead.update({ where: { id: lead.id }, data: { status: 'QUALIFIED', assignedTo: admin.id } });
    return NextResponse.json({ lead: updated });
  }
  if (lead.organizationId && lead.status === 'CONVERTED') return NextResponse.json({ error: 'Lead has already been converted' }, { status: 409 });

  const organizationName = String(body.organizationName || lead.propertyName || lead.company || `${lead.name}'s organization`).trim().slice(0, 160);
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  let organizationId = lead.organizationId;
  let userId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      let organization = organizationId ? await tx.organization.findUnique({ where: { id: organizationId } }) : null;
      if (!organization) {
        const baseSlug = slugify(organizationName);
        let slug = baseSlug;
        for (let index = 2; await tx.organization.findUnique({ where: { slug } }); index += 1) slug = `${baseSlug}-${index}`;
        organization = await tx.organization.create({ data: { name: organizationName, slug } });
        organizationId = organization.id;
      }
      const existing = await tx.user.findUnique({ where: { email: lead.email.toLowerCase() }, include: { membership: true } });
      if (existing?.membership && existing.membership.organizationId !== organization.id) throw new Error('This email already belongs to another organization.');
      const account = existing || await tx.user.create({ data: { email: lead.email.toLowerCase(), passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) } });
      await tx.organizationMembership.upsert({ where: { userId: account.id }, update: { organizationId: organization.id, role: 'OWNER', status: 'ACTIVE' }, create: { userId: account.id, organizationId: organization.id, role: 'OWNER', status: 'ACTIVE' } });
      await tx.customerInvitation.updateMany({ where: { email: lead.email.toLowerCase(), organizationId: organization.id, acceptedAt: null }, data: { expiresAt: new Date() } });
      await tx.customerInvitation.create({ data: { email: lead.email.toLowerCase(), organizationId: organization.id, userId: account.id, tokenHash, expiresAt, createdById: admin.id } });
      const updatedLead = await tx.salesLead.update({ where: { id: lead.id }, data: { organizationId: organization.id, status: 'INVITE_PENDING', assignedTo: admin.id } });
      return { organization, account, updatedLead };
    });
    userId = result.account.id;
    const websiteOrigin = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app';
    await sendCustomerInvitationEmail({ to: lead.email, inviteUrl: `${websiteOrigin}/portal/invite/${rawToken}`, expiresAt, organizationName: result.organization.name });
    const updatedLead = await prisma.salesLead.update({ where: { id: lead.id }, data: { status: 'CONVERTED', convertedAt: new Date() } });
    return NextResponse.json({ lead: updatedLead, organizationId: result.organization.id, userId });
  } catch (error) {
    console.error('[hq.customer-invitation] failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to convert lead' }, { status: 400 });
  }
}


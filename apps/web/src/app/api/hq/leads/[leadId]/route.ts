import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { sendCustomerInvitationEmail } from '@/lib/email/send-customer-invitation';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'customer';
}

function splitContactName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || null, lastName: parts.slice(1).join(' ') || null };
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
  if (lead.organizationId && ['CONVERTED', 'INVITE_PENDING'].includes(lead.status)) return NextResponse.json({ error: 'Lead conversion is already in progress or complete' }, { status: 409 });

  const organizationInput = body.organization && typeof body.organization === 'object' ? body.organization : {};
  const propertyInput = body.property && typeof body.property === 'object' ? body.property : {};
  const contactInput = body.contact && typeof body.contact === 'object' ? body.contact : {};
  const organizationName = String(organizationInput.name || body.organizationName || lead.organizationName || lead.company || `${lead.name}'s organization`).trim().slice(0, 160);
  const organizationSlug = String(organizationInput.slug || '').trim().slice(0, 70);
  const defaultCurrency = String(organizationInput.defaultCurrency || 'NGN').trim().slice(0, 8) || 'NGN';
  const defaultTimezone = String(organizationInput.defaultTimezone || 'Africa/Lagos').trim().slice(0, 80) || 'Africa/Lagos';
  const propertyName = String(propertyInput.name || lead.propertyName || organizationName).trim().slice(0, 160);
  const propertyAddress = String(propertyInput.address ?? lead.address ?? '').trim().slice(0, 240);
  const propertyCity = String(propertyInput.city ?? lead.city ?? lead.location ?? '').trim().slice(0, 120);
  const propertyState = String(propertyInput.state ?? lead.state ?? '').trim().slice(0, 120);
  const propertyCountry = String(propertyInput.country ?? lead.country ?? 'Nigeria').trim().slice(0, 120) || 'Nigeria';
  const propertyPhone = String(propertyInput.phone ?? lead.phone ?? '').trim().slice(0, 40);
  const portalEmail = String(contactInput.email || propertyInput.email || lead.email).trim().toLowerCase();
  const propertyWebsite = propertyInput.website ? String(propertyInput.website).trim().slice(0, 240) : (lead.website || null);
  const firstName = String(contactInput.firstName || lead.firstName || splitContactName(lead.name).firstName || '').trim().slice(0, 80) || null;
  const middleName = String(contactInput.middleName || lead.middleName || '').trim().slice(0, 80) || null;
  const lastName = String(contactInput.lastName || lead.lastName || splitContactName(lead.name).lastName || '').trim().slice(0, 120) || null;
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  let organizationId = lead.organizationId;
  let userId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      let organization = organizationId ? await tx.organization.findUnique({ where: { id: organizationId } }) : null;
      if (!organization) {
        const baseSlug = slugify(organizationSlug || organizationName);
        let slug = baseSlug;
        for (let index = 2; await tx.organization.findUnique({ where: { slug } }); index += 1) slug = `${baseSlug}-${index}`;
        organization = await tx.organization.create({ data: { name: organizationName, slug, defaultCurrency, defaultTimezone, settings: { onboarding: { source: 'HQ_LEAD_CONVERSION', leadId: lead.id } } } });
        organizationId = organization.id;
      }
      const existing = await tx.user.findUnique({ where: { email: portalEmail }, include: { membership: true } });
      if (existing?.membership && existing.membership.organizationId !== organization.id) throw new Error('This email already belongs to another organization.');
      const account = existing || await tx.user.create({ data: { email: portalEmail, firstName, middleName, lastName, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) } });
      await tx.organizationMembership.upsert({ where: { userId: account.id }, update: { organizationId: organization.id, role: 'OWNER', status: 'ACTIVE' }, create: { userId: account.id, organizationId: organization.id, role: 'OWNER', status: 'ACTIVE' } });
      if (!organization.portalOwnerUserId) await tx.organization.update({ where: { id: organization.id }, data: { portalOwnerUserId: account.id } });
      const property = await tx.property.findFirst({ where: { organizationId: organization.id }, select: { id: true } });
      if (!property) {
        await tx.property.create({ data: {
          organizationId: organization.id,
          name: propertyName,
          code: `PROP-${randomUUID().slice(0, 8).toUpperCase()}`,
          address: propertyAddress,
          city: propertyCity,
          state: propertyState,
          country: propertyCountry,
          phone: propertyPhone,
          email: portalEmail,
          website: propertyWebsite,
          baseCurrency: defaultCurrency,
          supportedCurrencies: [defaultCurrency],
          businessDate: new Date(),
          auditStatus: 'OPEN',
          settings: { onboarding: { needsCompletion: !(propertyAddress && propertyCity && propertyState && propertyCountry && propertyPhone), source: 'HQ_LEAD_CONVERSION', leadId: lead.id, roomCount: propertyInput.roomCount ?? lead.roomCount } },
        } });
      }
      await tx.customerInvitation.updateMany({ where: { email: portalEmail, organizationId: organization.id, acceptedAt: null }, data: { expiresAt: new Date() } });
      await tx.customerInvitation.create({ data: { email: portalEmail, organizationId: organization.id, userId: account.id, tokenHash, expiresAt, createdById: admin.id } });
      const updatedLead = await tx.salesLead.update({ where: { id: lead.id }, data: { organizationId: organization.id, status: 'INVITE_PENDING', assignedTo: admin.id } });
      return { organization, account, updatedLead };
    });
    userId = result.account.id;
    const websiteOrigin = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app';
    await sendCustomerInvitationEmail({ to: portalEmail, inviteUrl: `${websiteOrigin}/portal/invite/${rawToken}`, expiresAt, organizationName: result.organization.name });
    const updatedLead = await prisma.salesLead.update({ where: { id: lead.id }, data: { status: 'CONVERTED', convertedAt: new Date() } });
    return NextResponse.json({ lead: updatedLead, organizationId: result.organization.id, userId });
  } catch (error) {
    console.error('[hq.customer-invitation] failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to convert lead' }, { status: 400 });
  }
}

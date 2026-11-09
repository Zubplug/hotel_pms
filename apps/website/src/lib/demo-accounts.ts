import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';

export const DEMO_ROLES = [
  'GENERAL_MANAGER',
  'FRONT_DESK',
  'HR_MANAGER',
  'STOCK_MANAGER',
  'GENERAL_CASHIER',
  'NIGHT_AUDITOR',
  'ACCOUNTANT',
  'FNB_MANAGER',
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

function demoStore(client: any = prisma) {
  return client.demoAccount;
}

export function demoEnabled() {
  return process.env.DEMO_ACCOUNTS_ENABLED === 'true';
}

export async function isDemoAccountActive(userId: string) {
  const account = await demoStore().findUnique({
    where: { userId },
    select: { status: true, expiresAt: true },
  });
  return Boolean(account && account.status === 'ACTIVE' && account.expiresAt > new Date());
}

async function demoConfiguration() {
  const stored = await (prisma as any).demoConfiguration.findUnique({ where: { configKey: 'default' } });
  if (stored) {
    if (!stored.enabled || !stored.organizationId || !stored.propertyId || !stored.grantorUserId) {
      throw new Error('Demo access is disabled or incomplete in HQ settings.');
    }
    return {
      organizationId: stored.organizationId,
      propertyId: stored.propertyId,
      grantorUserId: stored.grantorUserId,
    };
  }

  const organizationId = process.env.DEMO_ORGANIZATION_ID?.trim();
  const propertyId = process.env.DEMO_PROPERTY_ID?.trim();
  const grantorUserId = process.env.DEMO_GRANTOR_USER_ID?.trim();
  if (!organizationId || !propertyId || !grantorUserId) {
    throw new Error('Demo environment is not configured by HQ.');
  }
  return { organizationId, propertyId, grantorUserId };
}

function generatePin() {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}

function generatePassword() {
  return `Demo-${randomBytes(12).toString('base64url')}`;
}

export async function provisionDemoAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  roleName: DemoRole;
  createdIp?: string | null;
}) {
  const config = await demoConfiguration();
  const normalizedEmail = input.email.trim().toLowerCase();
  const password = generatePassword();
  const pin = generatePin();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx: any) => {
    const organization = await tx.organization.findUnique({ where: { id: config.organizationId }, select: { id: true, name: true } });
    const property = await tx.property.findFirst({ where: { id: config.propertyId, organizationId: config.organizationId }, select: { id: true, name: true } });
    const grantor = await tx.user.findUnique({ where: { id: config.grantorUserId }, select: { id: true } });
    const role = await tx.role.findFirst({ where: { organizationId: config.organizationId, name: input.roleName }, select: { id: true, name: true } });
    if (!organization || !property || !grantor || !role) throw new Error('The HQ demo organization, property, grantor, or role is not configured.');

    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: await bcrypt.hash(password, 12),
        mobilePinHash: await bcrypt.hash(pin, 12),
        passwordSetAt: new Date(),
        mobilePinSetAt: new Date(),
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true },
    });
    const staff = await tx.staff.create({
      data: {
        organizationId: config.organizationId,
        userId: user.id,
        employeeId: `DEMO-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
        email: normalizedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        department: 'DEMO OPERATIONS',
        position: input.roleName,
        propertyAccess: [config.propertyId],
        isActive: true,
      },
      select: { id: true },
    });
    await tx.organizationMembership.create({ data: { userId: user.id, organizationId: config.organizationId, role: input.roleName, status: 'ACTIVE' } });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id, propertyId: config.propertyId, grantedBy: grantor.id } });
    await tx.user.update({ where: { id: user.id }, data: { staffId: staff.id } });
    const demoAccount = await demoStore(tx).create({
      data: {
        organizationId: config.organizationId,
        propertyId: config.propertyId,
        userId: user.id,
        staffId: staff.id,
        email: normalizedEmail,
        roleName: input.roleName,
        createdIp: input.createdIp || null,
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });
    return { organization, property, demoAccount, email: user.email, password, pin };
  });

  return result;
}

export async function expireDemoAccounts() {
  const now = new Date();
  const accounts = await demoStore().findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now } },
    select: { id: true, userId: true, staffId: true },
    orderBy: { expiresAt: 'asc' },
    take: 100,
  });
  let expired = 0;
  for (const account of accounts) {
    await prisma.$transaction(async (tx: any) => {
      const claimed = await demoStore(tx).updateMany({ where: { id: account.id, status: 'ACTIVE' }, data: { status: 'EXPIRED', expiredAt: now } });
      if (claimed.count !== 1) return;
      await tx.userRole.deleteMany({ where: { userId: account.userId } });
      await tx.organizationMembership.deleteMany({ where: { userId: account.userId } });
      await tx.staff.updateMany({ where: { id: account.staffId }, data: { userId: null, isActive: false, deletedAt: now, email: `expired-${account.id}@invalid.demo` } });
      await tx.user.updateMany({ where: { id: account.userId }, data: { email: `expired-${account.id}@invalid.demo`, passwordHash: randomBytes(48).toString('hex'), mobilePinHash: null, emailVerifiedAt: null, lockedUntil: new Date('2999-01-01T00:00:00.000Z'), sessionVersion: { increment: 1 } } });
      expired += 1;
    });
  }
  return { expired };
}

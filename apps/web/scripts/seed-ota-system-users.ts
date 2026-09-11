#!/usr/bin/env tsx
/**
 * seed:ota-system-users
 *
 * Creates a dedicated OTA integration system user for every organisation
 * that has (or will have) a ChannelConnection.
 *
 * Email convention: ota.system+{orgId}@lodgecore.internal
 *
 * Why per-org users?
 *   OrganizationMembership has UNIQUE(userId) — one user can only belong
 *   to one organisation. So we create one system user per org.
 *
 * Run:
 *   pnpm run seed:ota-system-users
 *   # or directly:
 *   pnpm tsx scripts/seed-ota-system-users.ts
 */

import { PrismaClient } from '@hotel-pms/db';

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  console.log(`\nSeeding OTA system users for ${orgs.length} organisation(s)...\n`);

  for (const org of orgs) {
    const email = `ota.system+${org.id}@lodgecore.internal`;

    // Upsert user
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: 'NO_LOGIN_OTA_SYSTEM_ACCOUNT',
      },
    });

    // Upsert membership — skip if already exists (UNIQUE userId constraint)
    const existingMem = await prisma.organizationMembership.findUnique({
      where: { userId: user.id },
    });

    if (existingMem) {
      if (existingMem.organizationId !== org.id) {
        console.warn(
          `  ⚠  ${org.name}: user ${email} already belongs to a different org (${existingMem.organizationId}). Skipping.`,
        );
      } else {
        console.log(`  ✓  ${org.name}: already seeded (${email})`);
      }
      continue;
    }

    await prisma.organizationMembership.create({
      data: {
        userId:         user.id,
        organizationId: org.id,
        role:           'ADMIN',
        status:         'ACTIVE',
      },
    });

    console.log(`  ✓  ${org.name}: created ${email}`);
  }

  console.log('\nDone.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

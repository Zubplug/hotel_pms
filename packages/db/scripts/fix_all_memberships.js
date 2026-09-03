const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Stanzel org
  const stanzelOrg = 'd08a652f-344b-4749-8dd6-09e63cb9740e';
  // Bally's org
  const ballysOrg = '79228592-e289-4d6e-b925-662e44513707';

  const assignments = [
    // Stanzel staff
    { email: 'fridayekunke@gmail.com',        orgId: stanzelOrg, role: 'MEMBER' },
    { email: 'ogechinweke@gmail.com',          orgId: stanzelOrg, role: 'MEMBER' },
    { email: 'godwinejikwaje@gmail.com',       orgId: stanzelOrg, role: 'MEMBER' },
    { email: 'acillibaby@yahoo.com',           orgId: stanzelOrg, role: 'MEMBER' },
    { email: 'kingsley71@gmail.com',           orgId: stanzelOrg, role: 'MEMBER' },
    { email: 'auditor@stanzelgrandresort.com', orgId: stanzelOrg, role: 'MEMBER' },
    // Bally's staff
    { email: 'receptionist@ballysplace.com',   orgId: ballysOrg,  role: 'MEMBER' },
  ];

  for (const a of assignments) {
    const user = await prisma.user.findUnique({ where: { email: a.email } });
    if (!user) { console.log(`⚠️  User not found: ${a.email}`); continue; }

    const existing = await prisma.organizationMembership.findUnique({ where: { userId: user.id } });
    if (existing) { console.log(`✅ Already has membership: ${a.email}`); continue; }

    await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: a.orgId,
        role: a.role,
        status: 'ACTIVE',
        permissions: []
      }
    });
    console.log(`✅ Created membership for ${a.email} → org: ${a.orgId} (${a.role})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

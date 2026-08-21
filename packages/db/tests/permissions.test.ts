import { PrismaClient } from '@prisma/client'
import assert from 'assert'

const prisma = new PrismaClient()

async function main() {
  console.log('Running permission integrity tests...')
  let passed = true;

  const testCases = [
    {
      roleName: 'MANAGER',
      mustHave: ['ACCESS_POS', 'ACCESS_CASH_MANAGEMENT', 'CONFIRM_CASH_HANDOVER', 'USE_EMERGENCY_CASHIER'],
      mustNotHave: []
    },
    {
      roleName: 'WAITER',
      mustHave: ['ACCESS_POS'],
      mustNotHave: ['ACCESS_CASH_MANAGEMENT', 'CONFIRM_CASH_HANDOVER']
    },
    {
      roleName: 'CASHIER',
      mustHave: ['ACCESS_POS', 'ACCESS_CASH_MANAGEMENT'],
      mustNotHave: ['CONFIRM_CASH_HANDOVER'] // Cashiers don't confirm their own handovers, managers do
    }
  ];

  for (const tc of testCases) {
    const role = await prisma.role.findFirst({
      where: { name: tc.roleName, isSystem: true },
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });

    if (!role) {
      console.error(`❌ Role ${tc.roleName} not found!`);
      passed = false;
      continue;
    }

    const caps = role.permissions.map(rp => rp.permission.name);

    for (const must of tc.mustHave) {
      if (!caps.includes(must)) {
        console.error(`❌ Role ${tc.roleName} is missing required capability: ${must}`);
        passed = false;
      }
    }

    for (const mustNot of tc.mustNotHave) {
      if (caps.includes(mustNot)) {
        console.error(`❌ Role ${tc.roleName} has forbidden capability: ${mustNot}`);
        passed = false;
      }
    }

    if (passed) {
      console.log(`✅ Role ${tc.roleName} passed.`);
    }
  }

  if (passed) {
    console.log('All integrity tests passed!');
    process.exit(0);
  } else {
    console.error('Integrity tests failed.');
    process.exit(1);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

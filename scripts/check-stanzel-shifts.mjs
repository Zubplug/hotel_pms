import { PrismaClient } from '@hotel-pms/db';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function main() {
  // 1. Find the Stanzel property
  const properties = await prisma.property.findMany({
    where: { name: { contains: 'stanzel', mode: 'insensitive' } },
    select: { id: true, name: true, businessDate: true }
  });

  if (properties.length === 0) {
    console.log('❌ No property found matching "stanzel"');
    return;
  }

  console.log('✅ Found properties:', properties.map(p => `${p.name} (${p.id})`).join(', '));

  const propertyIds = properties.map(p => p.id);

  // 2. Find all RETURNED frontdesk sessions with a variance
  const returnedSessions = await prisma.frontdeskSession.findMany({
    where: {
      propertyId: { in: propertyIds },
      status: 'RETURNED'
    },
    include: {
      staff: { select: { firstName: true, lastName: true, position: true } },
      audits: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { action: true, notes: true, createdAt: true }
      },
      exceptions: {
        select: { type: true, severity: true, amount: true, reason: true, status: true }
      }
    },
    orderBy: { businessDate: 'desc' }
  });

  if (returnedSessions.length === 0) {
    console.log('\n✅ No RETURNED frontdesk sessions found for Stanzel property.');
    return;
  }

  console.log(`\n⚠️  Found ${returnedSessions.length} RETURNED frontdesk session(s):\n`);
  console.log('='.repeat(80));

  for (const session of returnedSessions) {
    const variance = session.variance ? Number(session.variance) : 0;
    const declared = session.declaredCash ? Number(session.declaredCash) : null;
    const expected = Number(session.systemExpectedCash);

    console.log(`\nShift Reference : ${session.shiftReference}`);
    console.log(`Session ID      : ${session.id}`);
    console.log(`Staff           : ${session.staff.firstName} ${session.staff.lastName} (${session.staff.position})`);
    console.log(`Business Date   : ${session.businessDate.toISOString().split('T')[0]}`);
    console.log(`Status          : ${session.status}`);
    console.log(`Control Status  : ${session.controlStatus}`);
    console.log(`Variance Status : ${session.varianceStatus ?? 'N/A'}`);
    console.log(`Opening Float   : ${Number(session.openingFloat).toLocaleString()}`);
    console.log(`Expected Cash   : ${expected.toLocaleString()}`);
    console.log(`Declared Cash   : ${declared !== null ? declared.toLocaleString() : 'Not declared'}`);
    console.log(`Variance        : ${variance.toLocaleString()} ${Math.abs(variance) > 0 ? '⚠️' : '✅'}`);
    console.log(`Approval Notes  : ${session.approvalNotes ?? 'N/A'}`);
    console.log(`Reason Notes    : ${session.reasonNotes ?? 'N/A'}`);
    console.log(`Submitted At    : ${session.submittedAt?.toISOString() ?? 'N/A'}`);
    console.log(`Opened At       : ${session.openedAt.toISOString()}`);

    if (session.exceptions.length > 0) {
      console.log(`\n  Exceptions (${session.exceptions.length}):`);
      for (const ex of session.exceptions) {
        console.log(`    - [${ex.severity}] ${ex.type}: ${ex.reason} | Amount: ${ex.amount ? Number(ex.amount).toLocaleString() : 'N/A'} | Status: ${ex.status}`);
      }
    }

    if (session.audits.length > 0) {
      console.log(`\n  Recent Audit Trail:`);
      for (const audit of session.audits) {
        console.log(`    - ${audit.action} at ${audit.createdAt.toISOString()} | Notes: ${audit.notes ?? 'N/A'}`);
      }
    }

    console.log('\n' + '-'.repeat(80));
  }

  // 3. Also check for any other non-closed sessions (OPEN, SUBMITTED, UNDER_REVIEW, APPROVED_WITH_VARIANCE)
  const otherPendingSessions = await prisma.frontdeskSession.findMany({
    where: {
      propertyId: { in: propertyIds },
      status: { in: ['OPEN', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED_WITH_VARIANCE', 'CLOSING'] }
    },
    select: {
      id: true, shiftReference: true, status: true, businessDate: true, variance: true,
      declaredCash: true, systemExpectedCash: true, openingFloat: true,
      staff: { select: { firstName: true, lastName: true } }
    },
    orderBy: { businessDate: 'desc' }
  });

  if (otherPendingSessions.length > 0) {
    console.log(`\n📋 Other non-closed sessions (${otherPendingSessions.length}):`);
    for (const s of otherPendingSessions) {
      console.log(`  [${s.status}] ${s.shiftReference} | ${s.staff.firstName} ${s.staff.lastName} | Date: ${s.businessDate.toISOString().split('T')[0]} | Variance: ${s.variance ? Number(s.variance) : 'N/A'}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

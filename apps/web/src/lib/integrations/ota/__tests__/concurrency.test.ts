import { expect, test, vi, afterAll } from 'vitest';
import prisma from '@hotel-pms/db';
import { OTAReservationService, LockContentionError } from '../reservation-service';
import { MappingResolver } from '../resolver';
import crypto from 'crypto';

if (process.env.DATABASE_URL?.includes('aws-1-eu-west-1.pooler.supabase.com') || process.env.DATABASE_URL?.includes('neon.tech')) {
  console.error('ERROR: This test cannot be run against a production database!');
  process.exit(1);
}

// Mimic QStash outbox retry: retry up to maxAttempts times on transient errors
async function processWithRetry(
  orgId: string,
  propId: string,
  payload: any,
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await OTAReservationService.processReservation(orgId, propId, payload);
      return 'SUCCESS';
    } catch (e: any) {
      const isRetryable =
        e instanceof LockContentionError ||
        e?.retryable === true ||
        e?.message?.includes('Unable to start a transaction') ||
        e?.message?.includes('LOCK_CONTENTION') ||
        e?.message?.includes('Transaction already closed') ||
        e?.message?.includes('expired transaction');

      if (isRetryable && attempt < maxAttempts - 1) {
        // Exponential backoff with jitter (mirrors outbox worker)
        const backoff = Math.min(50 * Math.pow(2, attempt), 2000) + Math.random() * 50;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return `PERMANENT_FAILURE: ${e.message}`;
    }
  }
  return 'EXHAUSTED_RETRIES';
}

afterAll(async () => {
  await prisma.$disconnect();
});

test(
  'Concurrent OTA webhook requests produce exactly one native reservation',
  async () => {
    process.env.OTA_RESERVATION_IMPORT = 'true';

    // ── Seed pre-requisites ────────────────────────────────────────────────
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organisation in test DB');
    const property = await prisma.property.findFirst({ where: { organizationId: org.id } });
    if (!property) throw new Error('No property in test DB');

    let connection = await prisma.channelConnection.findFirst({
      where: { propertyId: property.id, provider: 'CHANNEX' },
    });
    if (!connection) {
      connection = await prisma.channelConnection.create({
        data: {
          organizationId:     org.id,
          propertyId:         property.id,
          provider:           'CHANNEX',
          status:             'CONNECTED',
          externalPropertyId: 'TEST_PROP_CONC',
          credentialsRef:     'none',
        },
      });
    }

    const roomType = await prisma.roomType.findFirst({ where: { propertyId: property.id } });
    if (!roomType) throw new Error('No room type in test DB');
    const ratePlan = await prisma.ratePlan.findFirst({ where: { propertyId: property.id } });
    if (!ratePlan) throw new Error('No rate plan in test DB');

    // System actor — must match the per-org email convention used by OTAReservationService
    const systemUserEmail = `ota.system+${org.id}@lodgecore.internal`;
    let systemUser = await prisma.user.findUnique({
      where: { email: systemUserEmail },
    });
    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email:        systemUserEmail,
          passwordHash: 'NO_LOGIN_OTA_SYSTEM_ACCOUNT',
        },
      });
    }
    const mem = await prisma.organizationMembership.findFirst({
      where: { userId: systemUser.id, organizationId: org.id },
    });
    if (!mem) {
      await prisma.organizationMembership.create({
        data: { userId: systemUser.id, organizationId: org.id, role: 'ADMIN', status: 'ACTIVE' },
      });
    }

    // Unique external reservation ID per test run
    const externalResId = 'CONC_TEST_' + crypto.randomUUID().substring(0, 8);

    const payload = {
      channelConnectionId:  connection.id,
      externalReservationId: externalResId,
      externalRevision:     '1',
      provider:             'CHANNEX',
      externalStatus:       'CONFIRMED' as const,
      checkIn:              new Date(),
      checkOut:             new Date(Date.now() + 86_400_000),
      adults:               2,
      children:             0,
      externalRoomTypeId:   'EXT_ROOM',
      externalRatePlanId:   'EXT_RATE',
      totalAmount:          150,
      currency:             'USD',
      guest:                { firstName: 'Race', lastName: 'Condition', email: 'race@test.com' },
      payment:              { method: 'PAY_AT_PROPERTY' as const, status: 'UNPAID' as const },
      rawPayload:           {},
    };

    vi.spyOn(MappingResolver, 'resolveReservation').mockResolvedValue({
      roomTypeId: roomType.id,
      ratePlanId: ratePlan.id,
    });

    // ── Fire 20 concurrent deliveries ─────────────────────────────────────
    const CONCURRENCY = 20;
    const promises = Array.from({ length: CONCURRENCY }, () =>
      processWithRetry(org.id, property.id, payload),
    );

    const results = await Promise.all(promises);

    console.log('Concurrency test results:', results);

    // All must be SUCCESS (either the one that created, or idempotent no-ops after retry)
    const failures = results.filter((r) => !r.startsWith('SUCCESS'));
    expect(failures, `Unexpected failures: ${failures.join(', ')}`).toHaveLength(0);

    // ── DB assertions ─────────────────────────────────────────────────────
    const nativeResCount = await prisma.reservation.count({
      where: { confirmationNumber: externalResId },
    });
    const channelResCount = await prisma.channelReservation.count({
      where: { externalReservationId: externalResId },
    });

    expect(nativeResCount, 'Expected exactly 1 native Reservation').toBe(1);
    expect(channelResCount, 'Expected exactly 1 ChannelReservation').toBe(1);
  },
  120_000, // 2-minute ceiling
);

test(
  'Out-of-order revisions land at highest revision with correct native state',
  async () => {
    process.env.OTA_RESERVATION_IMPORT = 'true';

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No org');
    const property = await prisma.property.findFirst({ where: { organizationId: org.id } });
    if (!property) throw new Error('No property');
    const connection = await prisma.channelConnection.findFirst({
      where: { propertyId: property.id, provider: 'CHANNEX' },
    });
    if (!connection) throw new Error('No CHANNEX connection — run first test');
    const roomType = await prisma.roomType.findFirst({ where: { propertyId: property.id } });
    if (!roomType) throw new Error('No room type');
    const ratePlan = await prisma.ratePlan.findFirst({ where: { propertyId: property.id } });
    if (!ratePlan) throw new Error('No rate plan');

    vi.spyOn(MappingResolver, 'resolveReservation').mockResolvedValue({
      roomTypeId: roomType.id,
      ratePlanId: ratePlan.id,
    });

    const externalResId = 'REV_ORDER_' + crypto.randomUUID().substring(0, 8);

    const base = {
      channelConnectionId:   connection.id,
      externalReservationId: externalResId,
      provider:              'CHANNEX',
      externalStatus:        'CONFIRMED' as const,
      checkIn:               new Date(),
      checkOut:              new Date(Date.now() + 86_400_000),
      adults:                2,
      children:              0,
      externalRoomTypeId:    'EXT_ROOM',
      externalRatePlanId:    'EXT_RATE',
      currency:              'USD',
      guest:                 { firstName: 'Rev', lastName: 'Order', email: 'rev@test.com' },
      payment:               { method: 'PAY_AT_PROPERTY' as const, status: 'UNPAID' as const },
      rawPayload:            {},
    };

    // Deliver revisions 10, 12, 11 concurrently
    const revisions = [
      { ...base, externalRevision: '10', totalAmount: 100 },
      { ...base, externalRevision: '12', totalAmount: 120 },
      { ...base, externalRevision: '11', totalAmount: 110 },
    ];

    const results = await Promise.all(
      revisions.map((p) => processWithRetry(org.id, property.id, p)),
    );
    console.log('Revision-order test results:', results);

    const failures = results.filter((r) => !r.startsWith('SUCCESS'));
    expect(failures, `Unexpected failures: ${failures.join(', ')}`).toHaveLength(0);

    const cr = await prisma.channelReservation.findFirst({
      where: { externalReservationId: externalResId },
    });
    expect(cr, 'ChannelReservation must exist').toBeTruthy();
    expect(cr!.externalRevision, 'Must settle at revision 12').toBe('12');

    // Native reservation total must match revision 12
    const nativeRes = await prisma.reservation.findFirst({
      where: { confirmationNumber: externalResId },
      select: { ratePlanSnapshot: true },
    });
    expect(nativeRes).toBeTruthy();
    const total = (nativeRes!.ratePlanSnapshot as any).total;
    expect(total, 'Native reservation total must be 120 (rev 12 state)').toBe(120);
  },
  120_000,
);

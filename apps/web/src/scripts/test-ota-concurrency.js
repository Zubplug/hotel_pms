import { PrismaClient } from '@hotel-pms/db';
import { OTAReservationService } from '../src/lib/integrations/ota/reservation-service';
import crypto from 'crypto';
const prisma = new PrismaClient();
async function run() {
    console.log('--- Starting OTA Concurrency Test ---');
    process.env.OTA_RESERVATION_IMPORT = 'true';
    // 1. Setup mock data
    const org = await prisma.organization.findFirst();
    if (!org)
        throw new Error('No org');
    const property = await prisma.property.findFirst({ where: { organizationId: org.id } });
    if (!property)
        throw new Error('No property');
    // Setup channel connection
    let connection = await prisma.channelConnection.findFirst();
    if (!connection) {
        connection = await prisma.channelConnection.create({
            data: {
                organizationId: org.id,
                propertyId: property.id,
                provider: 'CHANNEX',
                status: 'CONNECTED',
                externalPropertyId: 'TEST_PROP_1',
                credentialsRef: 'none'
            }
        });
    }
    const roomType = await prisma.roomType.findFirst({ where: { propertyId: property.id } });
    if (!roomType)
        throw new Error('No room type');
    const ratePlan = await prisma.ratePlan.findFirst({ where: { propertyId: property.id } });
    if (!ratePlan)
        throw new Error('No rate plan');
    // Ensure mapping exists
    await prisma.channelRoomMapping.upsert({
        where: { channelConnectionId_externalRoomTypeId: { channelConnectionId: connection.id, externalRoomTypeId: 'EXT_ROOM' } },
        create: { channelConnectionId: connection.id, externalRoomTypeId: 'EXT_ROOM', lodgecoreRoomTypeId: roomType.id, isActive: true },
        update: {}
    });
    await prisma.channelRatePlanMapping.upsert({
        where: { channelConnectionId_externalRatePlanId: { channelConnectionId: connection.id, externalRatePlanId: 'EXT_RATE' } },
        create: { channelConnectionId: connection.id, externalRatePlanId: 'EXT_RATE', lodgecoreRatePlanId: ratePlan.id, isActive: true },
        update: {}
    });
    // We must ensure the system user exists and is a member of this org
    let systemUser = await prisma.user.findUnique({ where: { email: 'system@lodgecore.internal' } });
    if (!systemUser) {
        systemUser = await prisma.user.create({
            data: { email: 'system@lodgecore.internal', passwordHash: 'dummy' }
        });
    }
    // Attempt to upsert org membership for testing
    const membership = await prisma.organizationMembership.findUnique({ where: { userId: systemUser.id } });
    if (!membership) {
        await prisma.organizationMembership.create({
            data: { userId: systemUser.id, organizationId: org.id, role: 'ADMIN' }
        });
    }
    const externalResId = 'CONC_TEST_' + crypto.randomUUID().substring(0, 8);
    console.log(`Using externalReservationId: ${externalResId}`);
    const payload = {
        channelConnectionId: connection.id,
        externalReservationId: externalResId,
        externalRevision: '1',
        provider: 'CHANNEX',
        externalStatus: 'CONFIRMED',
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000),
        adults: 2,
        children: 0,
        externalRoomTypeId: 'EXT_ROOM',
        externalRatePlanId: 'EXT_RATE',
        totalAmount: 150,
        currency: 'USD',
        guest: { firstName: 'Race', lastName: 'Condition', email: 'race@test.com' },
        payment: { method: 'PAY_AT_PROPERTY', status: 'UNPAID' },
        rawPayload: {}
    };
    // Fire 100 concurrent requests!
    const promises = [];
    for (let i = 0; i < 100; i++) {
        promises.push(OTAReservationService.processReservation(org.id, property.id, payload)
            .then(() => 'SUCCESS')
            .catch((e) => `ERROR: ${e.message}`));
    }
    const results = await Promise.all(promises);
    const successes = results.filter(r => r === 'SUCCESS').length;
    const errors = results.filter(r => r.startsWith('ERROR'));
    // We expect 1 success, and 99 errors (P2002 Unique Constraint)
    console.log(`Test finished.`);
    console.log(`Successes: ${successes}`);
    console.log(`Errors: ${errors.length}`);
    if (errors.length > 0) {
        console.log(`Sample error: ${errors[0]}`);
    }
    // Verify DB state
    const nativeResCount = await prisma.reservation.count({
        where: { confirmationNumber: externalResId }
    });
    const channelResCount = await prisma.channelReservation.count({
        where: { externalReservationId: externalResId }
    });
    console.log(`Native Reservations Created: ${nativeResCount}`);
    console.log(`Channel Reservations Created: ${channelResCount}`);
    if (nativeResCount === 1 && channelResCount === 1) {
        console.log('✅ TEST PASSED: EXACTLY ONE RESERVATION CREATED UNDER CONCURRENCY.');
    }
    else {
        console.log('❌ TEST FAILED: MULTIPLE OR ZERO RESERVATIONS CREATED.');
    }
    process.exit(0);
}
run().catch(console.error);

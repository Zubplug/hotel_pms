import { MappingResolver } from "../resolver";import { expect, test, vi } from 'vitest';
import prisma from '@hotel-pms/db';
import { OTAReservationService } from '../reservation-service';
import crypto from 'crypto';

test('Concurrent OTA webhook requests process exactly one native reservation', async () => {
    process.env.OTA_RESERVATION_IMPORT = 'true';
    if (process.env.DATABASE_URL) process.env.DATABASE_URL += (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=30';
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No org');
    const property = await prisma.property.findFirst({ where: { organizationId: org.id }});
    if (!property) throw new Error('No property');

    let connection = await prisma.channelConnection.findFirst({ where: { propertyId: property.id, provider: 'CHANNEX' }});
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

    const roomType = await prisma.roomType.findFirst({ where: { propertyId: property.id }});
    if (!roomType) throw new Error('No room type');
    const ratePlan = await prisma.ratePlan.findFirst({ where: { propertyId: property.id }});
    if (!ratePlan) throw new Error('No rate plan');

    let systemUser = await prisma.user.findUnique({ where: { email: 'system@lodgecore.internal' }});
    if (!systemUser) {
        systemUser = await prisma.user.create({
            data: { email: 'system@lodgecore.internal', passwordHash: 'dummy' }
        });
    }

    // UPSERT
    const mem = await prisma.organizationMembership.findFirst({ where: { userId: systemUser.id, organizationId: org.id } });
    if (!mem) {
        await prisma.organizationMembership.create({
            data: { userId: systemUser.id, organizationId: org.id, role: 'ADMIN' }
        });
    }

    const externalResId = 'CONC_TEST_' + crypto.randomUUID().substring(0, 8);

    const payload = {
        channelConnectionId: connection.id,
        externalReservationId: externalResId,
        externalRevision: '1',
        provider: 'CHANNEX',
        externalStatus: 'CONFIRMED' as const,
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000),
        adults: 2,
        children: 0,
        externalRoomTypeId: 'EXT_ROOM', // doesn't matter, mapper will just use default for test
        externalRatePlanId: 'EXT_RATE',
        totalAmount: 150,
        currency: 'USD',
        guest: { firstName: 'Race', lastName: 'Condition', email: 'race@test.com' },
        payment: { method: 'PAY_AT_PROPERTY' as const, status: 'UNPAID' as const },
        rawPayload: {}
    };

      '../resolver';
    vi.spyOn(MappingResolver, 'resolveReservation').mockResolvedValue({ roomTypeId: roomType.id, ratePlanId: ratePlan.id });

    const promises = [];
    for (let i = 0; i < 20; i++) {
        promises.push(
            OTAReservationService.processReservation(org.id, property.id, payload as any)
            .then(() => 'SUCCESS')
            .catch((e: any) => `ERROR: ${e.message}`)
        );
    }

    const results = await Promise.all(promises);

    console.log(results);

    const nativeResCount = await prisma.reservation.count({
        where: { confirmationNumber: externalResId }
    });

    const channelResCount = await prisma.channelReservation.count({
        where: { externalReservationId: externalResId }
    });

    expect(nativeResCount).toBe(1);
    expect(channelResCount).toBe(1);
}, 60000); // 60s timeout

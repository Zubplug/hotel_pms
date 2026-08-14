import prisma from './packages/db/src/client.ts';

async function test() {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: '3735ee3b-217a-403d-bc66-28ede75a5ca5' },
      include: {
        primaryGuest: true,
        property: { select: { id: true, name: true, city: true } },
        reservationRooms: {
          include: {
            room: {
              include: {
                doorLocks: { select: { id: true, lockCode: true, provider: true, status: true } },
                roomType: { select: { name: true, defaultBedConfig: true } },
              },
            },
          },
        },
        lockOperations: {
          orderBy: { requestedAt: 'desc' },
          take: 5,
        },
      },
    });
    console.log('Success:', !!reservation);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();

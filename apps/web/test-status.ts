import prisma from '@hotel-pms/db';

async function test() {
  const ops = await prisma.lockOperation.count({ where: { reservationId: '3735ee3b-217a-403d-bc66-28ede75a5ca5' } });
  console.log('OPS:', ops);
}
test();

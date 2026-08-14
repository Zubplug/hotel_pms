import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const checkInDate = new Date('2026-08-15T14:00:00Z')
  const checkOutDate = new Date('2026-08-18T10:00:00Z')
  
  const availableRooms = await prisma.room.findMany({
    where: {
      status: { notIn: ['MAINTENANCE', 'OUT_OF_ORDER'] },
      reservationRooms: {
        none: {
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          AND: [
            { checkIn: { lt: checkOutDate } },
            { checkOut: { gt: checkInDate } },
          ],
        },
      },
      roomBlocks: {
        none: {
          AND: [
            { startDate: { lt: checkOutDate } },
            { endDate: { gt: checkInDate } },
          ],
        },
      },
    }
  })
  console.log(`Available rooms: ${availableRooms.length}`)
}
main().finally(() => prisma.$disconnect())

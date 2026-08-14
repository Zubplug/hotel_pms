import http from 'http'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const property = await prisma.property.findFirst()
  const roomType = await prisma.roomType.findFirst({ where: { propertyId: property?.id } })
  
  console.log("Property ID:", property?.id)
  console.log("RoomType ID:", roomType?.id)
  
  const checkIn = new Date('2026-08-15').toISOString()
  const checkOut = new Date('2026-08-18').toISOString()
  
  // Fake the authentication session or just run the query logic directly
  // Actually, let's just run the DB query EXACTLY as it is in the API.
  
  const availableRooms = await prisma.room.findMany({
    where: {
      propertyId: property?.id,
      roomTypeId: roomType?.id,
      status: { notIn: ['MAINTENANCE', 'OUT_OF_ORDER'] },
      reservationRooms: {
        none: {
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          AND: [
            { checkIn: { lt: new Date(checkOut) } },
            { checkOut: { gt: new Date(checkIn) } },
          ],
        },
      },
      roomBlocks: {
        none: {
          AND: [
            { startDate: { lt: new Date(checkOut) } },
            { endDate: { gt: new Date(checkIn) } },
          ],
        },
      },
    },
    orderBy: { number: 'asc' },
  });
  
  console.log("Available rooms count:", availableRooms.length)
  console.log(availableRooms.map(r => r.number))
}
main().finally(() => prisma.$disconnect())

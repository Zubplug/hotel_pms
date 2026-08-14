import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rooms = await prisma.room.findMany({ include: { roomType: true } })
  console.log(`Rooms found: ${rooms.length}`)
  console.log(rooms.map(r => `${r.number} - ${r.status} (${r.roomType.name})`))
}
main().finally(() => prisma.$disconnect())

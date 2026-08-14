import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const roomTypes = await prisma.roomType.findMany({
    include: {
      _count: {
        select: { rooms: true }
      }
    }
  })
  
  for (const rt of roomTypes) {
    if (rt._count.rooms === 0) {
      console.log(`Deleting room type ${rt.name} (${rt.id}) which has 0 rooms.`)
      await prisma.roomType.delete({ where: { id: rt.id } })
    }
  }
}
main().finally(() => prisma.$disconnect())

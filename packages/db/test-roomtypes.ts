import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const property = await prisma.property.findFirst()
  console.log("Property ID:", property?.id)
  
  const roomTypes = await prisma.roomType.findMany({ where: { propertyId: property?.id } })
  console.log("Room Types:", roomTypes.length)
  console.log(roomTypes)
}
main().finally(() => prisma.$disconnect())

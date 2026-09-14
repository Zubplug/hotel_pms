import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.productCategory.findMany({ where: { name: { contains: 'Pool' } } }).then(console.log);

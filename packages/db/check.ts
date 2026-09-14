import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.posOutlet.findMany({ where: { name: { contains: 'Pool' } } }).then(console.log);

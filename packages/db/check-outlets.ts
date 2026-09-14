import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.posOutlet.findMany({ where: { name: 'Pool Bar' } }).then(console.log);

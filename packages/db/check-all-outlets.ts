import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.posOutlet.findMany({ select: { name: true, id: true } }).then(console.log);

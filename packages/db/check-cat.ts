import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.productCategory.findMany({ where: { name: 'Pool Passes' }, include: { outlet: { select: { name: true } } } }).then(console.log);

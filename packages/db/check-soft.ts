import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.productCategory.findMany({ where: { outletId: '82d743d3-48a3-4e34-8bec-440fcf8c13f4', name: 'Pool Passes' } }).then(console.log);

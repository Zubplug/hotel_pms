import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.posProduct.findMany({ where: { name: { contains: 'Pool Pass' } } }).then(c => console.log(c.map(x => ({ name: x.name, outlet: x.categoryId }))));

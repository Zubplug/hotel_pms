import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.productCategory.findMany().then(c => console.log(c.map(x => x.name))).finally(() => p.$disconnect());

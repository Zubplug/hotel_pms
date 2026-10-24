import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || (process.env.NEXT_PUBLIC_IS_DESKTOP === 'true' ? {} as PrismaClient : new PrismaClient());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
export * from './src/crypto';
export * from './src/billing';
export * from './src/trials';
export * from './src/flutterwave';
export * from './src/reach-wallet';
export * from './src/availability';
export * from './src/corporate-application';
export * from './src/canonical-room-rate-breakdown';
export default prisma;

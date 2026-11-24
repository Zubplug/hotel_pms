import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Keep a safe application-wide baseline for interactive transactions. Long
// workflows still provide their own larger timeout explicitly (for example
// Night Audit, inventory posting, and POS payment synchronization), while
// ordinary short mutations no longer fail at Prisma's 5-second default when
// Neon is briefly under normal contention.
const prismaTransactionOptions = {
  maxWait: 10_000,
  timeout: 15_000,
};

export const prisma = globalForPrisma.prisma || (
  process.env.NEXT_PUBLIC_IS_DESKTOP === 'true'
    ? {} as PrismaClient
    : new PrismaClient({ transactionOptions: prismaTransactionOptions })
);

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
export * from './corporate-credit-exposure';
export default prisma;

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({
    where: { 
      createdAt: { gte: new Date('2026-09-15T04:10:00Z') },
      collectionSource: 'RECEIVABLES'
    }
  });
  console.log(`Found ${payments.length} AR payments to backfill.`);
  
  if (payments.length === 0) return;

  const propertyId = payments[0].propertyId;
  const accounts = await prisma.chartOfAccount.findMany({ where: { propertyId } });
  
  const getAccountByCode = (code: string) => accounts.find(a => a.code === code)?.id;
  
  const arAccId = getAccountByCode('1140');
  
  if (!arAccId) {
    console.log("AR account not found");
    return;
  }

  const year = new Date().getFullYear();
  for (const p of payments) {
    await prisma.$transaction(async tx => {
      let debitAccId = getAccountByCode('1010'); // Default to Bank
      if (p.method === 'CASH') debitAccId = getAccountByCode('1000');
      if (p.method === 'POS') debitAccId = getAccountByCode('1120');
      if (p.method === 'CARD' || p.method === 'CARD_OFFLINE') debitAccId = getAccountByCode('1110');
      
      if (!debitAccId) debitAccId = getAccountByCode('1000');

      const entryNumber = `JE-${propertyId.slice(0, 8).toUpperCase()}-${year}-${crypto.randomUUID().split('-')[0].toUpperCase().slice(0,6)}`;
      
      const created = await tx.journalEntry.create({
        data: {
          propertyId,
          entryDate: p.createdAt,
          entryNumber,
          reference: p.receiptNumber,
          description: p.notes || `AR Payment Collection`,
          source: 'AUTO_PAYMENT',
          status: 'POSTED',
          totalDebit: p.amount,
          totalCredit: p.amount,
          createdBy: p.receivedBy,
          lines: {
            create: [
              {
                accountId: debitAccId,
                description: `Payment Received (${p.method})`,
                debit: p.amount,
                credit: 0,
                sourceType: 'PAYMENT',
                sourceId: p.id
              },
              {
                accountId: arAccId,
                description: 'AR Payment Collection',
                debit: 0,
                credit: p.amount,
                sourceType: 'PAYMENT',
                sourceId: p.id
              }
            ]
          }
        }
      });
      console.log(`Created journal ${created.entryNumber} for payment ${p.id}`);
    });
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

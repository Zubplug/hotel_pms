import { prisma } from './packages/db';
async function run() {
  const accounts = await prisma.cityLedgerAccount.findMany();
  for (const acc of accounts) {
    const invoices = await prisma.cityLedgerInvoice.findMany({ where: { accountId: acc.id, status: { not: 'VOID' } } });
    const payments = await prisma.cityLedgerEntry.findMany({ where: { accountId: acc.id, type: 'PAYMENT', status: { not: 'REVERSED' } }, include: { allocations: true } });
    
    const sumOut = invoices.reduce((s, i) => s + Number(i.outstandingAmount), 0);
    const sumUnapp = payments.reduce((s, p) => s + (Number(p.amount) - p.allocations.reduce((a,b)=>a+Number(b.amount),0)), 0);
    
    const trueBal = sumOut - sumUnapp;
    
    if (Number(acc.balance) !== trueBal) {
       console.log(`${acc.name}: DB_BAL=${acc.balance} TRUE_BAL=${trueBal} (Invoices=${sumOut}, Unapp=${sumUnapp})`);
    }
  }
}
run();

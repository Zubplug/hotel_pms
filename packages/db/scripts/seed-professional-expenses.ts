import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPENSE_ACCOUNTS = [
  { code: '6010', name: 'Office & Admin Supplies', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Office and administrative supplies and printing.', isActive: true },
  { code: '6020', name: 'Cleaning & Housekeeping Supplies', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Cleaning materials and housekeeping supplies.', isActive: true },
  { code: '6030', name: 'Guest Amenities & Supplies', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Guest room amenities and complimentary supplies.', isActive: true },
  { code: '6040', name: 'F&B Operational Supplies', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Food and beverage operational supplies.', isActive: true },
  { code: '6100', name: 'Repairs & Maintenance', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'General repairs, maintenance parts and supplies.', isActive: true },
  { code: '6200', name: 'Transportation & Travel', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Staff transportation, fuel, and travel expenses.', isActive: true },
  { code: '6300', name: 'Staff Welfare & Meals', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Staff welfare, meals, and medical expenses.', isActive: true },
  { code: '6400', name: 'Postage & Courier', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Postage, courier, and delivery charges.', isActive: true },
  { code: '6700', name: 'Miscellaneous Operations', type: 'EXPENSE', category: 'Operating Expenses', normalBalance: 'DEBIT', description: 'Miscellaneous operating expenses not otherwise classified.', isActive: true },
];

const EXPENSE_CATEGORIES = [
  { code: 'SUP-OFF', name: 'Office Supplies', debitAccount: '6010', isActive: true },
  { code: 'SUP-HKP', name: 'Housekeeping Supplies', debitAccount: '6020', isActive: true },
  { code: 'SUP-GST', name: 'Guest Amenities', debitAccount: '6030', isActive: true },
  { code: 'SUP-FNB', name: 'F&B Supplies', debitAccount: '6040', isActive: true },
  { code: 'R-M-GEN', name: 'Repairs & Maintenance', debitAccount: '6100', isActive: true },
  { code: 'TRV-GEN', name: 'Transportation', debitAccount: '6200', isActive: true },
  { code: 'STF-WLF', name: 'Staff Welfare', debitAccount: '6300', isActive: true },
  { code: 'POSTAGE', name: 'Postage & Courier', debitAccount: '6400', isActive: true },
  { code: 'MISC-OP', name: 'Miscellaneous', debitAccount: '6700', isActive: true },
];

async function main() {
  const properties = await prisma.property.findMany();
  
  for (const property of properties) {
    console.log(`Processing property: ${property.name} (${property.id})`);
    
    // 1. Ensure GL Accounts exist
    for (const acc of EXPENSE_ACCOUNTS) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { propertyId: property.id, code: acc.code }
      });
      if (!existing) {
        await prisma.chartOfAccount.create({
          data: {
            propertyId: property.id,
            ...acc
          } as any
        });
        console.log(`  + Created GL Account: ${acc.code} - ${acc.name}`);
      }
    }

    // 2. Ensure Expense Categories exist
    for (const cat of EXPENSE_CATEGORIES) {
      const existing = await prisma.expenseCategory.findFirst({
        where: { propertyId: property.id, code: cat.code }
      });
      if (!existing) {
        await prisma.expenseCategory.create({
          data: {
            propertyId: property.id,
            ...cat
          }
        });
        console.log(`  + Created Expense Category: ${cat.code} - ${cat.name}`);
      }
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

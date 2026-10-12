/*
 * Additive, idempotent ChartOfAccount completion.
 *
 * This is intentionally separate from the broad application seed. It never
 * updates, renames, deactivates, or deletes existing accounts or journals.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const accounts = [
  ['1000', 'Cash on Hand', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1010', 'Main Bank Account', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1100', 'Guest Ledger Receivable', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1110', 'Credit Card Receivable', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1120', 'POS Clearing', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1130', 'Bank Transfer Receivable', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1135', 'Mobile Money Receivable', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1140', 'City Ledger Receivable', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1150', 'Cheques in Hand', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1160', 'Cash in Transit', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1180', 'Employee Staff Loans', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1185', 'Salary Advances', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1300', 'Inventory', 'ASSET', 'Current Assets', 'DEBIT'],
  ['1500', 'Property & Equipment', 'ASSET', 'Fixed Assets', 'DEBIT'],
  ['1590', 'Accumulated Depreciation', 'ASSET', 'Fixed Assets', 'CREDIT'],
  ['2000', 'Accounts Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2100', 'Net Salaries Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2110', 'PAYE Tax Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2120', 'Pension Contribution Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2130', 'NHF Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2140', 'NSITF Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2150', 'ITF Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2160', 'Guest Refunds Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2200', 'Tax Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2210', 'Service Charge Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['2300', 'Corporate Advances and Unapplied Receipts', 'LIABILITY', 'Current Liabilities', 'CREDIT'],
  ['3000', 'Owner Equity', 'EQUITY', 'Equity', 'CREDIT'],
  ['3900', 'Retained Earnings', 'EQUITY', 'Equity', 'CREDIT'],
  ['4050', 'Room Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT'],
  ['4100', 'Swimming Pool Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT'],
  ['4200', 'Laundry Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT'],
  ['4250', 'Food and Beverage Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT'],
  ['4300', 'Event/Banquet Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT'],
  ['4400', 'Other Operating Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT'],
  ['4900', 'Revenue Rebates and Discounts', 'REVENUE', 'Contra Revenue', 'DEBIT'],
  ['4910', 'Refunds and Revenue Adjustments', 'REVENUE', 'Contra Revenue', 'DEBIT'],
  ['4950', 'Complimentary Allowance', 'REVENUE', 'Contra Revenue', 'DEBIT'],
  ['5000', 'Cost of Food & Beverage', 'EXPENSE', 'Cost of Goods Sold', 'DEBIT'],
  ['6000', 'Salaries & Wages Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT'],
  ['6500', 'Bank and Merchant Fees', 'EXPENSE', 'Operating Expenses', 'DEBIT'],
  ['6600', 'OTA Commissions', 'EXPENSE', 'Operating Expenses', 'DEBIT'],
  ['6800', 'Employer Pension Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT'],
  ['6810', 'NSITF Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT'],
  ['6820', 'ITF Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT'],
];

async function main() {
  const properties = await prisma.property.findMany({ select: { id: true, code: true } });
  let inserted = 0;

  for (const property of properties) {
    for (const [code, name, type, category, normalBalance] of accounts) {
      const existing = await prisma.chartOfAccount.findUnique({
        where: { propertyId_code: { propertyId: property.id, code } },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.chartOfAccount.create({
        data: { propertyId: property.id, code, name, type, category, normalBalance, isActive: true },
      });
      inserted += 1;
    }
  }

  console.log(JSON.stringify({ properties: properties.length, catalogAccounts: accounts.length, inserted }));
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

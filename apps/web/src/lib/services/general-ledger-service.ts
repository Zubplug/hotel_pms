import { randomUUID } from 'crypto';
import { prisma, AccountType, JournalEntryStatus, Prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { AccountingPeriodService } from './accounting-period-service';

export class GeneralLedgerService {
  static async listAccounts(ctx: TenantContext, propertyId: string) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    return prisma.chartOfAccount.findMany({
      where: { propertyId },
      orderBy: { code: 'asc' }
    });
  }

  static async createAccount(
    ctx: TenantContext,
    input: { propertyId: string; code: string; name: string; type: AccountType; category: string; normalBalance: 'DEBIT' | 'CREDIT'; description?: string; parentAccountId?: string; isActive?: boolean }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');

    const existing = await prisma.chartOfAccount.findUnique({
      where: { propertyId_code: { propertyId: input.propertyId, code: input.code } }
    });

    if (existing) {
      throw new Error(`Account code ${input.code} already exists for this property`);
    }

    return prisma.chartOfAccount.create({
      data: {
        ...input,
        isActive: input.isActive ?? true
      }
    });
  }

  static async listJournals(ctx: TenantContext, propertyId: string, filters?: { status?: JournalEntryStatus; periodId?: string }) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    
    const where: Prisma.JournalEntryWhereInput = {
      propertyId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.periodId && { periodId: filters.periodId })
    };

    return prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { entryDate: 'desc' }
    });
  }

  static async postJournal(
    ctx: TenantContext,
    input: {
      propertyId: string;
      entryDate: Date;
      description: string;
      reference?: string;
      sourceModule: string; // 'MANUAL', 'PAYROLL', 'AP', 'AR', etc.
      lines: Array<{ accountId: string; debit: number; credit: number; description?: string; reference?: string }>;
    }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');

    // 1. Validation
    await AccountingPeriodService.validatePeriodOpen(input.propertyId, input.entryDate);

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of input.lines) {
      if (line.debit < 0 || line.credit < 0) throw new Error('Debit and Credit must be positive numbers');
      if (line.debit > 0 && line.credit > 0) throw new Error('A line cannot have both debit and credit values');
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry unbalanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
    }

    // 2. Fetch Period
    const period = await AccountingPeriodService.getActive(input.propertyId);
    if (!period) throw new Error('No open accounting period found for this property');

    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          propertyId: input.propertyId,
          periodId: period.id,
          entryNumber: `JE-${Date.now()}-${randomUUID().substring(0, 4)}`,
          entryDate: input.entryDate,
          description: input.description,
          reference: input.reference,
          source: input.sourceModule,
          status: 'POSTED',
          totalDebit,
          totalCredit,
          postedBy: ctx.userId,
          createdBy: ctx.userId,
          lines: {
            create: input.lines.map(line => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
              reference: line.reference
            }))
          }
        },
        include: { lines: true }
      });

      // Update Account Balances
      for (const line of input.lines) {
        const account = await tx.chartOfAccount.findUnique({ where: { id: line.accountId } });
        if (!account) throw new Error(`Account ${line.accountId} not found`);

        let balanceChange = 0;
        // Normal balances: ASSET/EXPENSE are debit normal, LIABILITY/EQUITY/REVENUE are credit normal
        if (['ASSET', 'EXPENSE'].includes(account.type)) {
          balanceChange = line.debit - line.credit;
        } else {
          balanceChange = line.credit - line.debit;
        }

        await tx.chartOfAccount.update({
          where: { id: account.id },
          data: {} // currentBalance was removed, balances are calculated on the fly or via materialised views
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          userId: ctx.userId,
          action: 'JOURNAL_ENTRY_POSTED',
          resource: 'JournalEntry',
          resourceId: entry.id,

          requestId: randomUUID(),
          newValue: { description: input.description, amount: totalDebit }
        }
      });

      return entry;
    });
  }

  static async reverseJournal(ctx: TenantContext, entryId: string, reversalDate: Date, reason: string) {
    const original = await prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true }
    });

    if (!original) throw new Error('Journal Entry not found');
    if (!ctx.propertyIds.includes(original.propertyId)) throw new Error('Unauthorized');
    if (original.status !== 'POSTED') throw new Error(`Cannot reverse entry with status ${original.status}`);

    // Create the reversing entry lines
    const reversalLines = original.lines.map(line => ({
      accountId: line.accountId,
      debit: Number(line.credit), // Flip credit to debit
      credit: Number(line.debit), // Flip debit to credit
      description: `Reversal of ${original.reference || entryId}: ${line.description || ''}`,
    }));

    return prisma.$transaction(async (tx) => {
      // 1. Mark original as reversed
      await tx.journalEntry.update({
        where: { id: entryId },
        data: { status: 'REVERSED', reference: `${original.reference || ''} [REVERSED]` }
      });

      // 2. Post reversal entry
      const reversalEntry = await GeneralLedgerService.postJournal(ctx, {
        propertyId: original.propertyId,
        entryDate: reversalDate,
        description: `REVERSAL: ${reason}`,
        reference: `REV-${original.id.substring(0, 8)}`,
        sourceModule: 'MANUAL_REVERSAL',
        lines: reversalLines
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: original.propertyId,
          userId: ctx.userId,
          action: 'JOURNAL_ENTRY_REVERSED',
          resource: 'JournalEntry',
          resourceId: original.id,

          requestId: randomUUID(),
          newValue: { reason, reversalEntryId: reversalEntry.id }
        }
      });

      return reversalEntry;
    });
  }
}

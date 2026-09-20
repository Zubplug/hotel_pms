import { prisma } from '@hotel-pms/db';

export class AuditService {
  static async getAuditTrail(propertyId: string, startDate: Date, endDate: Date) {
    const logs = await prisma.auditLog.findMany({ where: { propertyId, createdAt: { gte: startDate, lte: endDate } }, orderBy: { createdAt: 'asc' }, take: 5000 });
    const rows = logs.map(log => ({ date: log.createdAt, action: log.action, resource: log.resource, resourceId: log.resourceId, actor: log.userEmail || log.userRole || 'System', requestId: log.requestId }));
    return { rows, summary: { date: null, action: 'TOTAL', resource: '', resourceId: '', actor: '', requestId: `${rows.length} events` } };
  }

  static async getManualJournals(propertyId: string, startDate: Date, endDate: Date) {
    const entries = await prisma.journalEntry.findMany({ where: { propertyId, source: 'MANUAL', entryDate: { gte: startDate, lte: endDate } }, orderBy: { entryDate: 'asc' } });
    const rows = entries.map(entry => ({ date: entry.entryDate, entryNumber: entry.entryNumber, description: entry.description, status: entry.status, debit: Number(entry.totalDebit), credit: Number(entry.totalCredit), postedBy: entry.postedBy || entry.createdBy || '' }));
    return { rows, summary: { date: null, entryNumber: 'TOTAL', description: '', status: `${rows.length} manual journals`, debit: rows.reduce((sum, row) => sum + row.debit, 0), credit: rows.reduce((sum, row) => sum + row.credit, 0), postedBy: '' } };
  }

  static async getBackdatedTransactions(propertyId: string, startDate: Date, endDate: Date) {
    const entries = await prisma.journalEntry.findMany({ where: { propertyId, entryDate: { gte: startDate, lte: endDate } }, orderBy: { entryDate: 'asc' } });
    const rows = entries.filter(entry => entry.createdAt.toISOString().slice(0, 10) !== entry.entryDate.toISOString().slice(0, 10)).map(entry => ({ entryDate: entry.entryDate, createdAt: entry.createdAt, entryNumber: entry.entryNumber, source: entry.source, description: entry.description, status: entry.status }));
    return { rows, summary: { entryDate: null, createdAt: null, entryNumber: 'TOTAL', source: '', description: `${rows.length} backdated entries`, status: '' } };
  }
  /**
   * Generates the Accounting Exception Report by querying unhandled exceptions.
   */
  static async getAccountingExceptions(propertyId: string, businessDate: Date) {
    const exceptions = await prisma.transactionException.findMany({
      where: {
        propertyId,
        businessDate: { gte: new Date(businessDate.getTime() - 86400000 * 7) }, // Look back 7 days
        status: { in: ['OPEN', 'PENDING_APPROVAL'] }
      },
      include: { payment: { include: { folio: true } }, posPayment: true },
      orderBy: { questionedAt: 'desc' }
    });

    const rows = exceptions.map(ex => ({
      date: ex.businessDate,
      exceptionId: ex.id.substring(0, 8),
      type: ex.proposedResolution || 'TRANSACTION_EXCEPTION',
      reference: ex.payment?.folio?.folioNumber || ex.posPaymentId || 'System',
      severity: ex.status,
      status: ex.status,
      description: ex.questionReason || ex.resolutionNotes || 'No description provided'
    }));

    return {
      rows,
      summary: {
        date: null,
        exceptionId: 'TOTAL',
        type: '',
        reference: '',
        severity: '',
        status: `${rows.length} Active Exceptions`,
        description: ''
      }
    };
  }

  /**
   * Generates the Night Audit Log for a specific date.
   */
  static async getNightAuditLog(propertyId: string, businessDate: Date) {
    const runs = await prisma.nightAudit.findMany({ where: { propertyId, businessDate }, orderBy: { createdAt: 'asc' } });
    const rows = runs.map(run => ({ timestamp: run.completedAt || run.createdAt, runId: run.id.substring(0, 8), stepName: 'Night audit run', status: run.status, durationMs: run.startedAt && run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : 0, notes: run.notes || `${run.errors} errors`, user: run.runBy || 'System' }));

    return {
      rows,
      summary: {
        timestamp: null,
        runId: '',
        stepName: 'TOTAL RUNS',
        status: runs.length.toString(),
        durationMs: rows.reduce((s, r) => s + r.durationMs, 0),
        notes: '',
        user: ''
      }
    };
  }
}

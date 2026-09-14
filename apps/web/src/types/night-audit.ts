export type AuditState = 'IN_PROGRESS' | 'POSTING' | 'COMPLETED' | 'FAILED' | 'OVERDUE' | 'PENDING';

export interface PropertyData {
  id: string;
  name: string;
  businessDate: Date | string | null;
  timezone: string;
  auditStatus: string;
  lastAuditAt: Date | string | null;
  baseCurrency: string;
  requireAuditAcknowledgements: boolean;
}

export interface RoomAnalytics {
  total: number;
  occupied: number;
  available: number;
  outOfOrder: number;
}

export interface TrendData {
  businessDate: Date | string;
  totalRevenue: number | string;
  occupancy: number | string;
  adr: number | string;
  revpar: number | string;
  financialSnapshot?: any;
}

export interface AnalyticsData {
  revenue: number;
  payments: number;
  cashVariance: number;
  latePostings: number;
  inHouseGuests: number;
  rooms: RoomAnalytics;
  trend: TrendData[];
}

export interface OperationalData {
  arrivals: any[];
  departures: any[];
  roomReconciliation: any[];
}

export interface SystemData {
  openPosSessions: any[];
  openFrontdeskSessions: any[];
  financialSyncConflicts: any[];
  openPosOrders: any[];
}

export interface FinancialData {
  highBalances: any[];
  pendingDiscounts: any[];
  unverifiedComplimentary: any[];
  pendingCheckInBypasses: any[];
  rateVariances: any[];
  pendingNightAuditPostings?: any[];
}

export interface CashData {
  cashHandovers: any[];
  unverifiedTransactions: any[];
  bankDeposits: any[];
  pendingCashDrops?: any[];
}

export interface FnbData {
  metrics: Record<string, any>;
  exceptions: {
    openOrders: any[];
    openSessions: any[];
    unreviewedVoids: any[];
    cashVarianceSessions: any[];
  };
  outlets: any[];
  sessions: any[];
}

export interface SummaryData {
  blockers: number;
  warnings: number;
}

export interface NightAuditData {
  property: PropertyData;
  businessDate: string;
  currentAudit: any;
  activeAudit: any;
  lastCompletedAudit?: any;
  auditState: AuditState;
  auditPhase: string;
  auditInProgress: boolean;
  auditDue: boolean;
  isBusinessDayAudited: boolean;
  analytics: AnalyticsData;
  operational: OperationalData;
  system: SystemData;
  financial: FinancialData;
  cash: CashData;
  fnb?: FnbData;
  summary: SummaryData;
  activityFeed?: any[];
  financialSnapshot?: any;
  accounting?: {
    period?: { id: string; name: string; status: string; periodStart: string; periodEnd: string } | null;
    journal?: { postedEntryCount: number; debit: number; credit: number; difference: number; status: string };
    transactionExceptions?: number;
    refunds?: { amount: number; count: number };
    folioActivity?: Array<{ type: string; amount: number; count: number }>;
  };
  closeControl?: { status: string; snapshot?: any; hasOpeningClosingBalance: boolean; balanceProofStatus?: string; linkedJournalEntryCount?: number; package?: any };
  insights?: Array<{ severity: string; title: string; detail: string; metric: number }>;
}

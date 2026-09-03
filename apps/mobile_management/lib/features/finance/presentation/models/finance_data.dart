// Executive Finance Screen — Data Models
// Mirrors the /api/mobile/v1/executive/finance API response exactly.
// Three financial states: AUDITED | PENDING_AUDIT

export 'finance_data.dart';

// ─── Property ───────────────────────────────────────────────────────────────
class FinanceProperty {
  final String id;
  final String name;
  final String currency;
  final String timezone;

  FinanceProperty({required this.id, required this.name, required this.currency, required this.timezone});

  factory FinanceProperty.fromJson(Map<String, dynamic> json) => FinanceProperty(
        id: json['id'] ?? '',
        name: json['name'] ?? '',
        currency: json['currency'] ?? 'NGN',
        timezone: json['timezone'] ?? 'Africa/Lagos',
      );
}

// ─── Audit Status ────────────────────────────────────────────────────────────
enum AuditStatus { audited, pendingAudit }

class LastAuditInfo {
  final String businessDate;
  final String? completedAt;
  final double totalRevenue;

  LastAuditInfo({required this.businessDate, required this.completedAt, required this.totalRevenue});

  factory LastAuditInfo.fromJson(Map<String, dynamic> json) => LastAuditInfo(
        businessDate: json['businessDate'] ?? '',
        completedAt: json['completedAt'],
        totalRevenue: (json['totalRevenue'] ?? 0).toDouble(),
      );
}

// ─── Audited Revenue ─────────────────────────────────────────────────────────
class AuditedRevenue {
  final double total;
  final double room;
  final double fb;
  final double bar;
  final double other;
  final double discounts;
  final double refunds;
  final double voids;
  final double net;
  final String businessDate;

  AuditedRevenue({
    required this.total,
    required this.room,
    required this.fb,
    required this.bar,
    required this.other,
    required this.discounts,
    required this.refunds,
    required this.voids,
    required this.net,
    required this.businessDate,
  });

  factory AuditedRevenue.fromJson(Map<String, dynamic> json) => AuditedRevenue(
        total: (json['total'] ?? 0).toDouble(),
        room: (json['room'] ?? 0).toDouble(),
        fb: (json['fb'] ?? 0).toDouble(),
        bar: (json['bar'] ?? 0).toDouble(),
        other: (json['other'] ?? 0).toDouble(),
        discounts: (json['discounts'] ?? 0).toDouble(),
        refunds: (json['refunds'] ?? 0).toDouble(),
        voids: (json['voids'] ?? 0).toDouble(),
        net: (json['net'] ?? 0).toDouble(),
        businessDate: json['businessDate'] ?? '',
      );
}

// ─── Live Today ───────────────────────────────────────────────────────────────
class LiveToday {
  final double total;
  final double roomCharges;
  final double posSales;

  LiveToday({required this.total, required this.roomCharges, required this.posSales});

  factory LiveToday.fromJson(Map<String, dynamic> json) => LiveToday(
        total: (json['total'] ?? 0).toDouble(),
        roomCharges: (json['roomCharges'] ?? 0).toDouble(),
        posSales: (json['posSales'] ?? 0).toDouble(),
      );
}

// ─── Revenue Trend ───────────────────────────────────────────────────────────
class TrendDay {
  final String businessDate;
  final double revenue;

  TrendDay({required this.businessDate, required this.revenue});

  factory TrendDay.fromJson(Map<String, dynamic> json) =>
      TrendDay(businessDate: json['businessDate'] ?? '', revenue: (json['revenue'] ?? 0).toDouble());
}

class RevenueTrend {
  final String period;
  final List<TrendDay> days;
  final double mtdTotal;
  final double mtdChangePercent;

  RevenueTrend({required this.period, required this.days, required this.mtdTotal, required this.mtdChangePercent});

  factory RevenueTrend.fromJson(Map<String, dynamic> json) => RevenueTrend(
        period: json['period'] ?? '7D',
        days: (json['days'] as List? ?? []).map((d) => TrendDay.fromJson(d)).toList(),
        mtdTotal: (json['mtdTotal'] ?? 0).toDouble(),
        mtdChangePercent: (json['mtdChangePercent'] ?? 0).toDouble(),
      );
}

// ─── Revenue Mix ─────────────────────────────────────────────────────────────
class RevenueMix {
  final double rooms;
  final double fb;
  final double bar;
  final double other;

  RevenueMix({required this.rooms, required this.fb, required this.bar, required this.other});

  factory RevenueMix.fromJson(Map<String, dynamic> json) => RevenueMix(
        rooms: (json['rooms'] ?? 0).toDouble(),
        fb: (json['fb'] ?? 0).toDouble(),
        bar: (json['bar'] ?? 0).toDouble(),
        other: (json['other'] ?? 0).toDouble(),
      );
}

// ─── Collections ─────────────────────────────────────────────────────────────
class CollectionMethod {
  final String method;
  final double amount;

  CollectionMethod({required this.method, required this.amount});

  factory CollectionMethod.fromJson(Map<String, dynamic> json) =>
      CollectionMethod(method: json['method'] ?? '', amount: (json['amount'] ?? 0).toDouble());
}

class Collections {
  final double total;
  final List<CollectionMethod> byMethod;

  Collections({required this.total, required this.byMethod});

  factory Collections.fromJson(Map<String, dynamic> json) => Collections(
        total: (json['total'] ?? 0).toDouble(),
        byMethod: (json['byMethod'] as List? ?? []).map((m) => CollectionMethod.fromJson(m)).toList(),
      );
}

// ─── Outstanding ─────────────────────────────────────────────────────────────
class OutstandingReceivables {
  final double total;
  final double guestBalances;
  final double corporateReceivables;
  final double other;

  OutstandingReceivables({
    required this.total,
    required this.guestBalances,
    required this.corporateReceivables,
    required this.other,
  });

  factory OutstandingReceivables.fromJson(Map<String, dynamic> json) => OutstandingReceivables(
        total: (json['total'] ?? 0).toDouble(),
        guestBalances: (json['guestBalances'] ?? 0).toDouble(),
        corporateReceivables: (json['corporateReceivables'] ?? 0).toDouble(),
        other: (json['other'] ?? 0).toDouble(),
      );
}

// ─── Cash Control ────────────────────────────────────────────────────────────
class CashSession {
  final String label;
  final String type; // FRONT_DESK | POS
  final double expected;
  final double? declared;
  final double? variance;
  final String status; // OPEN | OK | VARIANCE | OVERAGE

  CashSession({
    required this.label,
    required this.type,
    required this.expected,
    required this.declared,
    required this.variance,
    required this.status,
  });

  factory CashSession.fromJson(Map<String, dynamic> json) => CashSession(
        label: json['label'] ?? '',
        type: json['type'] ?? 'FRONT_DESK',
        expected: (json['expected'] ?? 0).toDouble(),
        declared: json['declared'] != null ? (json['declared'] as num).toDouble() : null,
        variance: json['variance'] != null ? (json['variance'] as num).toDouble() : null,
        status: json['status'] ?? 'OPEN',
      );
}

class CashControl {
  final double totalExpected;
  final double totalDeclared;
  final double totalVariance;
  final List<CashSession> sessions;

  CashControl({
    required this.totalExpected,
    required this.totalDeclared,
    required this.totalVariance,
    required this.sessions,
  });

  factory CashControl.fromJson(Map<String, dynamic> json) => CashControl(
        totalExpected: (json['totalExpected'] ?? 0).toDouble(),
        totalDeclared: (json['totalDeclared'] ?? 0).toDouble(),
        totalVariance: (json['totalVariance'] ?? 0).toDouble(),
        sessions: (json['sessions'] as List? ?? []).map((s) => CashSession.fromJson(s)).toList(),
      );
}

// ─── Transaction Controls ────────────────────────────────────────────────────
class TxControl {
  final double total;
  final int count;
  final double changePercent;

  TxControl({required this.total, required this.count, required this.changePercent});

  factory TxControl.fromJson(Map<String, dynamic> json) => TxControl(
        total: (json['total'] ?? 0).toDouble(),
        count: json['count'] ?? 0,
        changePercent: (json['changePercent'] ?? 0).toDouble(),
      );
}

class OverridesControl {
  final int count;
  OverridesControl({required this.count});
  factory OverridesControl.fromJson(Map<String, dynamic> json) => OverridesControl(count: json['count'] ?? 0);
}

class TransactionControls {
  final TxControl discounts;
  final TxControl voids;
  final TxControl refunds;
  final OverridesControl overrides;

  TransactionControls({
    required this.discounts,
    required this.voids,
    required this.refunds,
    required this.overrides,
  });

  factory TransactionControls.fromJson(Map<String, dynamic> json) => TransactionControls(
        discounts: TxControl.fromJson(json['discounts'] ?? {}),
        voids: TxControl.fromJson(json['voids'] ?? {}),
        refunds: TxControl.fromJson(json['refunds'] ?? {}),
        overrides: OverridesControl.fromJson(json['overrides'] ?? {}),
      );
}

// ─── Guest Credits ───────────────────────────────────────────────────────────
class GuestCredits {
  final double depositsHeld;
  final double creditsAvailable;
  final double creditsConsumed;

  GuestCredits({required this.depositsHeld, required this.creditsAvailable, required this.creditsConsumed});

  factory GuestCredits.fromJson(Map<String, dynamic> json) => GuestCredits(
        depositsHeld: (json['depositsHeld'] ?? 0).toDouble(),
        creditsAvailable: (json['creditsAvailable'] ?? 0).toDouble(),
        creditsConsumed: (json['creditsConsumed'] ?? 0).toDouble(),
      );
}

// ─── Financial Attention ──────────────────────────────────────────────────────
class FinancialAttention {
  final String id;
  final String priority;
  final String category;
  final String title;
  final String summary;
  final int affectedCount;
  final double totalAmount;

  FinancialAttention({
    required this.id,
    required this.priority,
    required this.category,
    required this.title,
    required this.summary,
    required this.affectedCount,
    required this.totalAmount,
  });

  factory FinancialAttention.fromJson(Map<String, dynamic> json) => FinancialAttention(
        id: json['id'] ?? '',
        priority: json['priority'] ?? 'P3',
        category: json['category'] ?? 'FINANCE',
        title: json['title'] ?? '',
        summary: json['summary'] ?? '',
        affectedCount: json['affectedCount'] ?? 0,
        totalAmount: (json['totalAmount'] ?? 0).toDouble(),
      );
}

// ─── Root Model ───────────────────────────────────────────────────────────────
class FinanceDashboardData {
  final FinanceProperty property;
  final String businessDate;
  final String generatedAt;
  final AuditStatus auditStatus;
  final LastAuditInfo? lastAudit;
  final AuditedRevenue auditedRevenue;
  final LiveToday liveToday;
  final RevenueTrend trend;
  final RevenueMix revenueMix;
  final Collections collections;
  final OutstandingReceivables outstanding;
  final CashControl cashControl;
  final TransactionControls transactionControls;
  final GuestCredits guestCredits;
  final List<FinancialAttention> attention;

  FinanceDashboardData({
    required this.property,
    required this.businessDate,
    required this.generatedAt,
    required this.auditStatus,
    required this.lastAudit,
    required this.auditedRevenue,
    required this.liveToday,
    required this.trend,
    required this.revenueMix,
    required this.collections,
    required this.outstanding,
    required this.cashControl,
    required this.transactionControls,
    required this.guestCredits,
    required this.attention,
  });

  factory FinanceDashboardData.fromJson(Map<String, dynamic> json) {
    // Support both wrapped { data: {...} } and unwrapped responses
    final d = json['data'] ?? json;
    return FinanceDashboardData(
      property: FinanceProperty.fromJson(d['property'] ?? {}),
      businessDate: d['businessDate'] ?? '',
      generatedAt: d['generatedAt'] ?? '',
      auditStatus: (d['auditStatus'] ?? '') == 'AUDITED' ? AuditStatus.audited : AuditStatus.pendingAudit,
      lastAudit: d['lastAudit'] != null ? LastAuditInfo.fromJson(d['lastAudit']) : null,
      auditedRevenue: AuditedRevenue.fromJson(d['auditedRevenue'] ?? {}),
      liveToday: LiveToday.fromJson(d['liveToday'] ?? {}),
      trend: RevenueTrend.fromJson(d['trend'] ?? {}),
      revenueMix: RevenueMix.fromJson(d['revenueMix'] ?? {}),
      collections: Collections.fromJson(d['collections'] ?? {}),
      outstanding: OutstandingReceivables.fromJson(d['outstanding'] ?? {}),
      cashControl: CashControl.fromJson(d['cashControl'] ?? {}),
      transactionControls: TransactionControls.fromJson(d['transactionControls'] ?? {}),
      guestCredits: GuestCredits.fromJson(d['guestCredits'] ?? {}),
      attention: (d['attention'] as List? ?? []).map((a) => FinancialAttention.fromJson(a)).toList(),
    );
  }
}

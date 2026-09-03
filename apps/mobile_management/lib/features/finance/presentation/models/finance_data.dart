// Executive Finance Screen — Data Models
// Mirrors the structurally separated /api/mobile/v1/executive/finance API response.

export 'finance_data.dart';

// ─── Property ───────────────────────────────────────────────────────────────
class FinanceProperty {
  final String name;
  final String currency;

  FinanceProperty({required this.name, required this.currency});

  factory FinanceProperty.fromJson(Map<String, dynamic> json) => FinanceProperty(
        name: json['name'] ?? '',
        currency: json['currency'] ?? 'NGN',
      );
}

// ─── Audited Data ────────────────────────────────────────────────────────────
class AuditedPeriodData {
  final double revenue;
  final double roomRevenue;
  final double fbRevenue;
  final double otherRevenue;
  final double discounts;
  final double refunds;
  final double netRevenue;

  AuditedPeriodData({
    required this.revenue,
    required this.roomRevenue,
    required this.fbRevenue,
    required this.otherRevenue,
    required this.discounts,
    required this.refunds,
    required this.netRevenue,
  });

  factory AuditedPeriodData.fromJson(Map<String, dynamic> json) => AuditedPeriodData(
        revenue: (json['revenue'] ?? 0).toDouble(),
        roomRevenue: (json['roomRevenue'] ?? 0).toDouble(),
        fbRevenue: (json['fbRevenue'] ?? 0).toDouble(),
        otherRevenue: (json['otherRevenue'] ?? 0).toDouble(),
        discounts: (json['discounts'] ?? 0).toDouble(),
        refunds: (json['refunds'] ?? 0).toDouble(),
        netRevenue: (json['netRevenue'] ?? 0).toDouble(),
      );
}

// ─── Live Data ───────────────────────────────────────────────────────────────
class LiveActivityData {
  final double revenueActivity;
  final double roomCharges;
  final double posSales;
  final double collections;

  LiveActivityData({
    required this.revenueActivity,
    required this.roomCharges,
    required this.posSales,
    required this.collections,
  });

  factory LiveActivityData.fromJson(Map<String, dynamic> json) => LiveActivityData(
        revenueActivity: (json['revenueActivity'] ?? 0).toDouble(),
        roomCharges: (json['roomCharges'] ?? 0).toDouble(),
        posSales: (json['posSales'] ?? 0).toDouble(),
        collections: (json['collections'] ?? 0).toDouble(),
      );
}

// ─── Cash Control ────────────────────────────────────────────────────────────
class CashSession {
  final String label;
  final double expected;
  final double? declared;
  final double? variance;
  final String status;
  final String businessDate;

  CashSession({
    required this.label,
    required this.expected,
    required this.declared,
    required this.variance,
    required this.status,
    required this.businessDate,
  });

  factory CashSession.fromJson(Map<String, dynamic> json) => CashSession(
        label: json['label'] ?? '',
        expected: (json['expected'] ?? 0).toDouble(),
        declared: json['declared'] != null ? (json['declared'] as num).toDouble() : null,
        variance: json['variance'] != null ? (json['variance'] as num).toDouble() : null,
        status: json['status'] ?? 'OPEN',
        businessDate: json['businessDate'] ?? '',
      );
}

class CashControlAggregate {
  final double expected;
  final double declared;
  final double variance;
  final int sessionsWithVariance;
  final int significantVariances;
  final List<CashSession> sessions;

  CashControlAggregate({
    required this.expected,
    required this.declared,
    required this.variance,
    required this.sessionsWithVariance,
    required this.significantVariances,
    required this.sessions,
  });

  factory CashControlAggregate.fromJson(Map<String, dynamic> json) => CashControlAggregate(
        expected: (json['expected'] ?? 0).toDouble(),
        declared: (json['declared'] ?? 0).toDouble(),
        variance: (json['variance'] ?? 0).toDouble(),
        sessionsWithVariance: json['sessionsWithVariance'] ?? 0,
        significantVariances: json['significantVariances'] ?? 0,
        sessions: (json['sessions'] as List? ?? []).map((s) => CashSession.fromJson(s)).toList(),
      );
}

// ─── Transaction Controls ────────────────────────────────────────────────────
class TransactionControlAggregate {
  final double discounts;
  final double voids;
  final double refunds;
  final int overrides;

  TransactionControlAggregate({
    required this.discounts,
    required this.voids,
    required this.refunds,
    required this.overrides,
  });

  factory TransactionControlAggregate.fromJson(Map<String, dynamic> json) => TransactionControlAggregate(
        discounts: (json['discounts'] ?? 0).toDouble(),
        voids: (json['voids'] ?? 0).toDouble(),
        refunds: (json['refunds'] ?? 0).toDouble(),
        overrides: json['overrides'] ?? 0,
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

// ─── Outstanding Receivables ─────────────────────────────────────────────────
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

// ─── Current Alerts ─────────────────────────────────────────────────────────
class CurrentAlert {
  final String id;
  final String priority;
  final String category;
  final String title;
  final String summary;
  final int affectedCount;
  final double totalAmount;

  CurrentAlert({
    required this.id,
    required this.priority,
    required this.category,
    required this.title,
    required this.summary,
    required this.affectedCount,
    required this.totalAmount,
  });

  factory CurrentAlert.fromJson(Map<String, dynamic> json) => CurrentAlert(
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
  final String period;
  final String businessDate;
  final String? lastAuditedBusinessDate;
  final FinanceProperty property;
  final AuditedPeriodData audited;
  final LiveActivityData liveSinceLastAudit;
  final CashControlAggregate cashControl;
  final TransactionControlAggregate transactionControls;
  final OutstandingReceivables outstanding;
  final GuestCredits guestCredits;
  final List<CurrentAlert> currentAlerts;

  FinanceDashboardData({
    required this.period,
    required this.businessDate,
    required this.lastAuditedBusinessDate,
    required this.property,
    required this.audited,
    required this.liveSinceLastAudit,
    required this.cashControl,
    required this.transactionControls,
    required this.outstanding,
    required this.guestCredits,
    required this.currentAlerts,
  });

  factory FinanceDashboardData.fromJson(Map<String, dynamic> json) {
    final d = json['data'] ?? json;
    return FinanceDashboardData(
      period: d['period'] ?? 'TODAY',
      businessDate: d['businessDate'] ?? '',
      lastAuditedBusinessDate: d['lastAuditedBusinessDate'],
      property: FinanceProperty.fromJson(d['property'] ?? {}),
      audited: AuditedPeriodData.fromJson(d['audited'] ?? {}),
      liveSinceLastAudit: LiveActivityData.fromJson(d['liveSinceLastAudit'] ?? {}),
      cashControl: CashControlAggregate.fromJson(d['cashControl'] ?? {}),
      transactionControls: TransactionControlAggregate.fromJson(d['transactionControls'] ?? {}),
      outstanding: OutstandingReceivables.fromJson(d['outstanding'] ?? {}),
      guestCredits: GuestCredits.fromJson(d['guestCredits'] ?? {}),
      currentAlerts: (d['currentAlerts'] as List? ?? []).map((a) => CurrentAlert.fromJson(a)).toList(),
    );
  }
}

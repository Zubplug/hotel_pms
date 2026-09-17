// ─── F&B Dashboard Data Models ────────────────────────────────────────────────
// Single source of truth for the mobile F&B analytics screen.
// All revenue figures originate from the authoritative kpi.ts calculateDailyRevenue()
// on the backend — no client-side revenue calculations.

class FnbDashboardData {
  final String businessDate;
  final FnbSummary summary;
  final List<FnbOutlet> outletBreakdown;
  final List<FnbTopItem> topSellingItems;
  final List<FnbHourlySlot> hourlyRevenue;
  final List<FnbPaymentMethod> paymentBreakdown;
  final List<FnbTrendDay> revenueBy7Days;
  final FnbPosOperations posOperations;

  FnbDashboardData({
    required this.businessDate,
    required this.summary,
    required this.outletBreakdown,
    required this.topSellingItems,
    required this.hourlyRevenue,
    required this.paymentBreakdown,
    required this.revenueBy7Days,
    required this.posOperations,
  });

  factory FnbDashboardData.fromJson(Map<String, dynamic> json) {
    return FnbDashboardData(
      businessDate: json['businessDate'] ?? '',
      summary: FnbSummary.fromJson(json['summary'] ?? {}),
      outletBreakdown: (json['outletBreakdown'] as List? ?? [])
          .map((e) => FnbOutlet.fromJson(e as Map<String, dynamic>))
          .toList(),
      topSellingItems: (json['topSellingItems'] as List? ?? [])
          .map((e) => FnbTopItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      hourlyRevenue: (json['hourlyRevenue'] as List? ?? [])
          .map((e) => FnbHourlySlot.fromJson(e as Map<String, dynamic>))
          .toList(),
      paymentBreakdown: (json['paymentBreakdown'] as List? ?? [])
          .map((e) => FnbPaymentMethod.fromJson(e as Map<String, dynamic>))
          .toList(),
      revenueBy7Days: (json['revenueBy7Days'] as List? ?? [])
          .map((e) => FnbTrendDay.fromJson(e as Map<String, dynamic>))
          .toList(),
      posOperations: FnbPosOperations.fromJson(json['posOperations'] ?? {}),
    );
  }
}

class FnbSummary {
  final double totalFnbRevenue;
  final double foodRevenue;
  final double beverageRevenue;
  final double barRevenue;
  final int totalCovers;
  final double avgCheckPerCover;
  final int totalOrders;
  final double avgCheckPerOrder;
  final double revenueTrend;   // % vs yesterday
  final double voidRate;       // item-count based (%)
  final double discountRate;   // % of gross revenue

  FnbSummary({
    required this.totalFnbRevenue,
    required this.foodRevenue,
    required this.beverageRevenue,
    required this.barRevenue,
    required this.totalCovers,
    required this.avgCheckPerCover,
    required this.totalOrders,
    required this.avgCheckPerOrder,
    required this.revenueTrend,
    required this.voidRate,
    required this.discountRate,
  });

  /// Total of all mutually exclusive buckets — for stacked chart
  double get stackedTotal => foodRevenue + beverageRevenue + barRevenue;

  factory FnbSummary.fromJson(Map<String, dynamic> json) {
    return FnbSummary(
      totalFnbRevenue:   (json['totalFnbRevenue']   ?? 0).toDouble(),
      foodRevenue:       (json['foodRevenue']        ?? 0).toDouble(),
      beverageRevenue:   (json['beverageRevenue']    ?? 0).toDouble(),
      barRevenue:        (json['barRevenue']         ?? 0).toDouble(),
      totalCovers:       (json['totalCovers']        ?? 0) as int,
      avgCheckPerCover:  (json['avgCheckPerCover']   ?? 0).toDouble(),
      totalOrders:       (json['totalOrders']        ?? 0) as int,
      avgCheckPerOrder:  (json['avgCheckPerOrder']   ?? 0).toDouble(),
      revenueTrend:      (json['revenueTrend']       ?? 0).toDouble(),
      voidRate:          (json['voidRate']           ?? 0).toDouble(),
      discountRate:      (json['discountRate']       ?? 0).toDouble(),
    );
  }
}

class FnbOutlet {
  final String outletId;
  final String outletName;
  final String outletType;
  final double revenue;
  final int covers;
  final double avgCheck;
  final FnbTopItemRef? topItem;

  FnbOutlet({
    required this.outletId,
    required this.outletName,
    required this.outletType,
    required this.revenue,
    required this.covers,
    required this.avgCheck,
    this.topItem,
  });

  factory FnbOutlet.fromJson(Map<String, dynamic> json) {
    return FnbOutlet(
      outletId:   json['outletId']   ?? '',
      outletName: json['outletName'] ?? '',
      outletType: json['outletType'] ?? '',
      revenue:    (json['revenue']   ?? 0).toDouble(),
      covers:     (json['covers']    ?? 0) as int,
      avgCheck:   (json['avgCheck']  ?? 0).toDouble(),
      topItem:    json['topItem'] != null
          ? FnbTopItemRef.fromJson(json['topItem'])
          : null,
    );
  }
}

class FnbTopItemRef {
  final String name;
  final int qty;

  FnbTopItemRef({required this.name, required this.qty});

  factory FnbTopItemRef.fromJson(Map<String, dynamic> json) {
    return FnbTopItemRef(
      name: json['name'] ?? '',
      qty:  (json['qty'] ?? 0) as int,
    );
  }
}

class FnbTopItem {
  final String productName;
  final String fnbClass;   // 'FOOD' | 'BEVERAGE' | 'OTHER'
  final int qty;
  final double revenue;

  FnbTopItem({
    required this.productName,
    required this.fnbClass,
    required this.qty,
    required this.revenue,
  });

  factory FnbTopItem.fromJson(Map<String, dynamic> json) {
    return FnbTopItem(
      productName: json['productName'] ?? '',
      fnbClass:    json['fnbClass']    ?? 'FOOD',
      qty:         (json['qty']        ?? 0) as int,
      revenue:     (json['revenue']    ?? 0).toDouble(),
    );
  }
}

class FnbHourlySlot {
  final int hour;
  final double revenue;
  final int orders;
  final int covers;

  FnbHourlySlot({
    required this.hour,
    required this.revenue,
    required this.orders,
    required this.covers,
  });

  factory FnbHourlySlot.fromJson(Map<String, dynamic> json) {
    return FnbHourlySlot(
      hour:    (json['hour']    ?? 0) as int,
      revenue: (json['revenue'] ?? 0).toDouble(),
      orders:  (json['orders']  ?? 0) as int,
      covers:  (json['covers']  ?? 0) as int,
    );
  }
}

class FnbPaymentMethod {
  final String method;
  final double amount;
  final double pct;

  FnbPaymentMethod({
    required this.method,
    required this.amount,
    required this.pct,
  });

  factory FnbPaymentMethod.fromJson(Map<String, dynamic> json) {
    return FnbPaymentMethod(
      method: json['method'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      pct:    (json['pct']    ?? 0).toDouble(),
    );
  }
}

class FnbTrendDay {
  final String date;
  final double foodRevenue;
  final double beverageRevenue;
  final double barRevenue;
  final double fbRevenue;
  final double total;

  FnbTrendDay({
    required this.date,
    required this.foodRevenue,
    required this.beverageRevenue,
    required this.barRevenue,
    required this.fbRevenue,
    required this.total,
  });

  factory FnbTrendDay.fromJson(Map<String, dynamic> json) {
    return FnbTrendDay(
      date:             json['date']             ?? '',
      foodRevenue:      (json['foodRevenue']      ?? 0).toDouble(),
      beverageRevenue:  (json['beverageRevenue']  ?? 0).toDouble(),
      barRevenue:       (json['barRevenue']       ?? 0).toDouble(),
      fbRevenue:        (json['fbRevenue']        ?? 0).toDouble(),
      total:            (json['total']            ?? 0).toDouble(),
    );
  }
}

class FnbPosOperations {
  final int terminalsOnline;
  final int terminalsTotal;
  final int activeSessions;
  final FnbVoidsSummary voids;
  final FnbDiscountsSummary discounts;

  FnbPosOperations({
    required this.terminalsOnline,
    required this.terminalsTotal,
    required this.activeSessions,
    required this.voids,
    required this.discounts,
  });

  factory FnbPosOperations.fromJson(Map<String, dynamic> json) {
    return FnbPosOperations(
      terminalsOnline: (json['terminalsOnline'] ?? 0) as int,
      terminalsTotal:  (json['terminalsTotal']  ?? 0) as int,
      activeSessions:  (json['activeSessions']  ?? 0) as int,
      voids:           FnbVoidsSummary.fromJson(json['voids'] ?? {}),
      discounts:       FnbDiscountsSummary.fromJson(json['discounts'] ?? {}),
    );
  }
}

class FnbVoidsSummary {
  final int count;
  final double amount;

  FnbVoidsSummary({required this.count, required this.amount});

  factory FnbVoidsSummary.fromJson(Map<String, dynamic> json) {
    return FnbVoidsSummary(
      count:  (json['count']  ?? 0) as int,
      amount: (json['amount'] ?? 0).toDouble(),
    );
  }
}

class FnbDiscountsSummary {
  final int count;
  final double amount;

  FnbDiscountsSummary({required this.count, required this.amount});

  factory FnbDiscountsSummary.fromJson(Map<String, dynamic> json) {
    return FnbDiscountsSummary(
      count:  (json['count']  ?? 0) as int,
      amount: (json['amount'] ?? 0).toDouble(),
    );
  }
}

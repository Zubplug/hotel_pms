export 'finance_data.dart';

class FinanceProperty {
  final String id;
  final String name;
  final String currency;
  final String timezone;

  FinanceProperty({
    required this.id,
    required this.name,
    required this.currency,
    required this.timezone,
  });

  factory FinanceProperty.fromJson(Map<String, dynamic> json) {
    return FinanceProperty(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      currency: json['currency'] ?? 'NGN',
      timezone: json['timezone'] ?? 'Africa/Lagos',
    );
  }
}

class RevenueData {
  final double posted;
  final double changePercent;

  RevenueData({required this.posted, required this.changePercent});

  factory RevenueData.fromJson(Map<String, dynamic> json) {
    return RevenueData(
      posted: (json['posted'] ?? 0).toDouble(),
      changePercent: (json['changePercent'] ?? 0).toDouble(),
    );
  }
}

class PaymentMethodAmount {
  final String method;
  final double amount;

  PaymentMethodAmount({required this.method, required this.amount});

  factory PaymentMethodAmount.fromJson(Map<String, dynamic> json) {
    return PaymentMethodAmount(
      method: json['method'] ?? 'UNKNOWN',
      amount: (json['amount'] ?? 0).toDouble(),
    );
  }
}

class PaymentsData {
  final double total;
  final List<PaymentMethodAmount> byMethod;

  PaymentsData({required this.total, required this.byMethod});

  factory PaymentsData.fromJson(Map<String, dynamic> json) {
    var list = json['byMethod'] as List? ?? [];
    return PaymentsData(
      total: (json['total'] ?? 0).toDouble(),
      byMethod: list.map((i) => PaymentMethodAmount.fromJson(i)).toList(),
    );
  }
}

class OutstandingData {
  final double total;

  OutstandingData({required this.total});

  factory OutstandingData.fromJson(Map<String, dynamic> json) {
    return OutstandingData(
      total: (json['total'] ?? 0).toDouble(),
    );
  }
}

class PerformanceData {
  final double occupancy;
  final double adr;
  final double revpar;

  PerformanceData({
    required this.occupancy,
    required this.adr,
    required this.revpar,
  });

  factory PerformanceData.fromJson(Map<String, dynamic> json) {
    return PerformanceData(
      occupancy: (json['occupancy'] ?? 0).toDouble(),
      adr: (json['adr'] ?? 0).toDouble(),
      revpar: (json['revpar'] ?? 0).toDouble(),
    );
  }
}

class RevenueMixData {
  final double accommodation;
  final double foodAndBeverage;
  final double bar;
  final double other;

  RevenueMixData({
    required this.accommodation,
    required this.foodAndBeverage,
    required this.bar,
    required this.other,
  });

  factory RevenueMixData.fromJson(Map<String, dynamic> json) {
    return RevenueMixData(
      accommodation: (json['accommodation'] ?? 0).toDouble(),
      foodAndBeverage: (json['foodAndBeverage'] ?? 0).toDouble(),
      bar: (json['bar'] ?? 0).toDouble(),
      other: (json['other'] ?? 0).toDouble(),
    );
  }
}

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

  factory FinancialAttention.fromJson(Map<String, dynamic> json) {
    return FinancialAttention(
      id: json['id'] ?? '',
      priority: json['priority'] ?? 'P3',
      category: json['category'] ?? 'FINANCE',
      title: json['title'] ?? '',
      summary: json['summary'] ?? '',
      affectedCount: json['affectedCount'] ?? 0,
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
    );
  }
}

class TrendDay {
  final String businessDate;
  final double revenue;

  TrendDay({required this.businessDate, required this.revenue});

  factory TrendDay.fromJson(Map<String, dynamic> json) {
    return TrendDay(
      businessDate: json['businessDate'] ?? '',
      revenue: (json['revenue'] ?? 0).toDouble(),
    );
  }
}

class TrendData {
  final String period;
  final List<TrendDay> days;

  TrendData({required this.period, required this.days});

  factory TrendData.fromJson(Map<String, dynamic> json) {
    var list = json['days'] as List? ?? [];
    return TrendData(
      period: json['period'] ?? '7_BUSINESS_DAYS',
      days: list.map((i) => TrendDay.fromJson(i)).toList(),
    );
  }
}

class FinanceDashboardData {
  final FinanceProperty property;
  final String businessDate;
  final String generatedAt;
  final RevenueData revenue;
  final PaymentsData payments;
  final OutstandingData outstanding;
  final PerformanceData performance;
  final RevenueMixData revenueMix;
  final List<FinancialAttention> attention;
  final TrendData trend;

  FinanceDashboardData({
    required this.property,
    required this.businessDate,
    required this.generatedAt,
    required this.revenue,
    required this.payments,
    required this.outstanding,
    required this.performance,
    required this.revenueMix,
    required this.attention,
    required this.trend,
  });

  factory FinanceDashboardData.fromJson(Map<String, dynamic> json) {
    var data = json['data'] ?? {};
    
    var attList = data['attention'] as List? ?? [];
    
    return FinanceDashboardData(
      property: FinanceProperty.fromJson(data['property'] ?? {}),
      businessDate: data['businessDate'] ?? '',
      generatedAt: data['generatedAt'] ?? '',
      revenue: RevenueData.fromJson(data['revenue'] ?? {}),
      payments: PaymentsData.fromJson(data['payments'] ?? {}),
      outstanding: OutstandingData.fromJson(data['outstanding'] ?? {}),
      performance: PerformanceData.fromJson(data['performance'] ?? {}),
      revenueMix: RevenueMixData.fromJson(data['revenueMix'] ?? {}),
      attention: attList.map((i) => FinancialAttention.fromJson(i)).toList(),
      trend: TrendData.fromJson(data['trend'] ?? {}),
    );
  }
}

class ExecutiveDashboardData {
  final String propertyName;
  final DateTime lastUpdatedAt;
  
  final ExecutiveOverview executiveOverview;
  final TodaySnapshot todaySnapshot;
  final RoomSummary roomSummary;
  final PerformanceTrends performanceTrends;
  final List<AlertData> requiresAttention;
  final SyncSummary syncSummary;

  ExecutiveDashboardData({
    required this.propertyName,
    required this.lastUpdatedAt,
    required this.executiveOverview,
    required this.todaySnapshot,
    required this.roomSummary,
    required this.performanceTrends,
    required this.requiresAttention,
    required this.syncSummary,
  });

  factory ExecutiveDashboardData.fromJson(Map<String, dynamic> json) {
    return ExecutiveDashboardData(
      propertyName: json['property']['name'] ?? 'LodgeCore Property',
      lastUpdatedAt: DateTime.parse(json['generatedAt']),
      executiveOverview: ExecutiveOverview.fromJson(json['executiveOverview']),
      todaySnapshot: TodaySnapshot.fromJson(json['todaySnapshot']),
      roomSummary: RoomSummary.fromJson(json['roomSummary']),
      performanceTrends: PerformanceTrends.fromJson(json['performanceTrends']),
      requiresAttention: (json['requiresAttention'] as List?)
              ?.map((item) => AlertData.fromJson(item))
              .toList() ??
          [],
      syncSummary: SyncSummary.fromJson(json['syncSummary']),
    );
  }
}

class ExecutiveOverview {
  final double occupancyPercent;
  final double adr;
  final double revpar;
  final int availableRooms;
  final int occupiedRooms;
  final double totalRevenue;
  final double roomRevenue;
  final double fbRevenue;
  
  final double occupancyTrend;
  final double adrTrend;
  final double revparTrend;
  final double totalRevenueTrend;
  final double roomRevenueTrend;
  final double fbRevenueTrend;

  ExecutiveOverview({
    required this.occupancyPercent,
    required this.adr,
    required this.revpar,
    required this.availableRooms,
    required this.occupiedRooms,
    required this.totalRevenue,
    required this.roomRevenue,
    required this.fbRevenue,
    required this.occupancyTrend,
    required this.adrTrend,
    required this.revparTrend,
    required this.totalRevenueTrend,
    required this.roomRevenueTrend,
    required this.fbRevenueTrend,
  });

  factory ExecutiveOverview.fromJson(Map<String, dynamic> json) {
    final revenue = json['revenue'] ?? {};
    return ExecutiveOverview(
      occupancyPercent: (json['occupancyPercent'] ?? 0).toDouble(),
      adr: (json['adr'] ?? 0).toDouble(),
      revpar: (json['revpar'] ?? 0).toDouble(),
      availableRooms: json['availableRooms'] ?? 0,
      occupiedRooms: json['occupiedRooms'] ?? 0,
      totalRevenue: (revenue['totalRevenue'] ?? 0).toDouble(),
      roomRevenue: (revenue['roomRevenue'] ?? 0).toDouble(),
      fbRevenue: (revenue['fbRevenue'] ?? 0).toDouble(),
      occupancyTrend: (json['occupancyTrend'] ?? 0).toDouble(),
      adrTrend: (json['adrTrend'] ?? 0).toDouble(),
      revparTrend: (json['revparTrend'] ?? 0).toDouble(),
      totalRevenueTrend: (json['totalRevenueTrend'] ?? 0).toDouble(),
      roomRevenueTrend: (json['roomRevenueTrend'] ?? 0).toDouble(),
      fbRevenueTrend: (json['fbRevenueTrend'] ?? 0).toDouble(),
    );
  }
}

class TodaySnapshot {
  final int arrivals;
  final int departures;
  final int inHouseGuests;
  final int occupiedRooms;
  final int availableRooms;
  final int outOfOrderRooms;

  TodaySnapshot({
    required this.arrivals,
    required this.departures,
    required this.inHouseGuests,
    required this.occupiedRooms,
    required this.availableRooms,
    required this.outOfOrderRooms,
  });

  factory TodaySnapshot.fromJson(Map<String, dynamic> json) {
    return TodaySnapshot(
      arrivals: json['arrivals'] ?? 0,
      departures: json['departures'] ?? 0,
      inHouseGuests: json['inHouseGuests'] ?? 0,
      occupiedRooms: json['occupiedRooms'] ?? 0,
      availableRooms: json['availableRooms'] ?? 0,
      outOfOrderRooms: json['outOfOrderRooms'] ?? 0,
    );
  }
}

class RoomSummary {
  final int occupied;
  final int vacant;
  final int dirty;
  final int ooo;

  RoomSummary({
    required this.occupied,
    required this.vacant,
    required this.dirty,
    required this.ooo,
  });

  factory RoomSummary.fromJson(Map<String, dynamic> json) {
    return RoomSummary(
      occupied: json['occupied'] ?? 0,
      vacant: json['vacant'] ?? 0,
      dirty: json['dirty'] ?? 0,
      ooo: json['ooo'] ?? 0,
    );
  }
}

class PerformanceTrends {
  final double total;
  final double changePercent;
  final List<TrendDay> days;

  PerformanceTrends({
    required this.total,
    required this.changePercent,
    required this.days,
  });

  factory PerformanceTrends.fromJson(Map<String, dynamic> json) {
    return PerformanceTrends(
      total: (json['total'] ?? 0).toDouble(),
      changePercent: (json['changePercent'] ?? 0).toDouble(),
      days: (json['days'] as List?)?.map((d) => TrendDay.fromJson(d)).toList() ?? [],
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

class AlertData {
  final String id;
  final String priority; // 'P0', 'P1', 'P2', 'P3'
  final String title;
  final String summary;
  final String category;
  final String action;

  AlertData({
    required this.id,
    required this.priority,
    required this.title,
    required this.summary,
    required this.category,
    required this.action,
  });

  factory AlertData.fromJson(Map<String, dynamic> json) {
    return AlertData(
      id: json['id'] ?? '',
      priority: json['priority'] ?? 'P3',
      title: json['title'] ?? '',
      summary: json['summary'] ?? '',
      category: json['category'] ?? 'OPERATIONS',
      action: json['action'] ?? '',
    );
  }
}

class SyncSummary {
  final int online;
  final int offline;
  final int total;

  SyncSummary({
    required this.online,
    required this.offline,
    required this.total,
  });

  factory SyncSummary.fromJson(Map<String, dynamic> json) {
    return SyncSummary(
      online: json['online'] ?? 0,
      offline: json['offline'] ?? 0,
      total: json['total'] ?? 0,
    );
  }
}

class ExecutiveDashboardData {
  final String propertyName;
  final DateTime lastUpdatedAt;
  final String businessDate; // e.g. '2026-09-03'

  final ExecutiveOverview executiveOverview;
  final TodaySnapshot todaySnapshot;
  final RoomSummary roomSummary;
  final PerformanceTrends performanceTrends;
  final List<AlertData> requiresAttention;
  final SyncSummary syncSummary;

  ExecutiveDashboardData({
    required this.propertyName,
    required this.lastUpdatedAt,
    required this.businessDate,
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
      businessDate: json['businessDate'] ?? '',
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
  final String lastAuditedDate;
  final double lastAuditedRevenue;
  final double liveRevenue;
  final double occupancyPercent;
  final double adr;
  final double revpar;
  final int availableRooms;
  final int occupiedRooms;
  final double totalRevenue;
  // Revenue sub-breakdown (newly exposed from RevenueSnapshot)
  final double roomRevenue;
  final double fbRevenue;
  final double barRevenue;
  final double otherRevenue;

  final double occupancyTrend;
  final double adrTrend;
  final double revparTrend;
  final double totalRevenueTrend;
  final double roomRevenueTrend;
  final double fbRevenueTrend;

  ExecutiveOverview({
    required this.lastAuditedDate,
    required this.lastAuditedRevenue,
    required this.liveRevenue,
    required this.occupancyPercent,
    required this.adr,
    required this.revpar,
    required this.availableRooms,
    required this.occupiedRooms,
    required this.totalRevenue,
    required this.roomRevenue,
    required this.fbRevenue,
    required this.barRevenue,
    required this.otherRevenue,
    required this.occupancyTrend,
    required this.adrTrend,
    required this.revparTrend,
    required this.totalRevenueTrend,
    required this.roomRevenueTrend,
    required this.fbRevenueTrend,
  });

  /// TRevPAR computed client-side — Total Revenue / Available Rooms
  double get trevpar => availableRooms > 0 ? totalRevenue / availableRooms : 0;

  factory ExecutiveOverview.fromJson(Map<String, dynamic> json) {
    final revenue = json['revenue'] ?? {};
    return ExecutiveOverview(
      lastAuditedDate: json['lastAuditedDate'] ?? '',
      lastAuditedRevenue: (json['lastAuditedRevenue'] ?? 0).toDouble(),
      liveRevenue: (json['liveRevenue'] ?? 0).toDouble(),
      occupancyPercent: (json['occupancyPercent'] ?? 0).toDouble(),
      adr: (json['adr'] ?? 0).toDouble(),
      revpar: (json['revpar'] ?? 0).toDouble(),
      availableRooms: json['availableRooms'] ?? 0,
      occupiedRooms: json['occupiedRooms'] ?? 0,
      totalRevenue: (revenue['totalRevenue'] ?? json['liveRevenue'] ?? 0).toDouble(),
      // Revenue sub-breakdown — now forwarded directly in executiveOverview
      roomRevenue: (json['roomRevenue'] ?? revenue['roomRevenue'] ?? 0).toDouble(),
      fbRevenue: (json['fbRevenue'] ?? revenue['fbRevenue'] ?? 0).toDouble(),
      barRevenue: (json['barRevenue'] ?? revenue['barRevenue'] ?? 0).toDouble(),
      otherRevenue: (json['otherRevenue'] ?? revenue['otherRevenue'] ?? 0).toDouble(),
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
  final int vipArrivals;   // newly exposed from hotel-pulse.ts
  final int occupiedRooms;
  final int availableRooms;
  final int outOfOrderRooms;
  final int totalRooms;    // newly exposed

  TodaySnapshot({
    required this.arrivals,
    required this.departures,
    required this.inHouseGuests,
    required this.vipArrivals,
    required this.occupiedRooms,
    required this.availableRooms,
    required this.outOfOrderRooms,
    required this.totalRooms,
  });

  factory TodaySnapshot.fromJson(Map<String, dynamic> json) {
    return TodaySnapshot(
      arrivals: json['arrivals'] ?? 0,
      departures: json['departures'] ?? 0,
      inHouseGuests: json['inHouseGuests'] ?? 0,
      vipArrivals: json['vipArrivals'] ?? 0,
      occupiedRooms: json['occupiedRooms'] ?? 0,
      availableRooms: json['availableRooms'] ?? 0,
      outOfOrderRooms: json['outOfOrderRooms'] ?? 0,
      totalRooms: json['totalRooms'] ?? 0,
    );
  }
}

class RoomSummary {
  final int occupied;
  final int vacant;
  final int dirty;
  final int occupiedDirty; // occupied rooms with dirty housekeeping (stayover dirty)
  final int ooo;
  final int total;         // newly exposed

  RoomSummary({
    required this.occupied,
    required this.vacant,
    required this.dirty,
    required this.occupiedDirty,
    required this.ooo,
    required this.total,
  });

  factory RoomSummary.fromJson(Map<String, dynamic> json) {
    return RoomSummary(
      occupied: json['occupied'] ?? 0,
      vacant: json['vacant'] ?? 0,
      dirty: json['dirty'] ?? 0,
      occupiedDirty: json['occupiedDirty'] ?? 0,
      ooo: json['ooo'] ?? 0,
      total: json['total'] ?? 0,
    );
  }
}

class PerformanceTrends {
  final double total;
  final double changePercent; // newly forwarded — % change vs prior period
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
  final double occupancyPct; // newly forwarded — per-day occupancy %

  TrendDay({
    required this.businessDate,
    required this.revenue,
    required this.occupancyPct,
  });

  factory TrendDay.fromJson(Map<String, dynamic> json) {
    return TrendDay(
      businessDate: json['businessDate'] ?? '',
      revenue: (json['revenue'] ?? 0).toDouble(),
      occupancyPct: (json['occupancyPct'] ?? 0).toDouble(),
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
  final int affectedCount;

  AlertData({
    required this.id,
    required this.priority,
    required this.title,
    required this.summary,
    required this.category,
    required this.action,
    required this.affectedCount,
  });

  factory AlertData.fromJson(Map<String, dynamic> json) {
    return AlertData(
      id: json['id'] ?? '',
      priority: json['priority'] ?? 'P3',
      title: json['title'] ?? '',
      summary: json['summary'] ?? '',
      category: json['category'] ?? 'OPERATIONS',
      action: json['action'] ?? '',
      affectedCount: json['affectedCount'] ?? 0,
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

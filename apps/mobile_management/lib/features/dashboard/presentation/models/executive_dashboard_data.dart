class ExecutiveDashboardData {
  final String propertyName;
  final DateTime lastUpdatedAt;
  
  final PerformanceData performance;
  final HotelPulse? hotelPulse;
  final List<AlertData>? attention;
  final ApprovalSummary? approvals;
  final RevenueTrend? revenueTrend;
  final List<ArrivalData>? arrivals;
  final GuestPulse? guestPulse;
  final OperationsPulse? operationsPulse;
  final ExecutiveBrief? executiveBrief;

  ExecutiveDashboardData({
    required this.propertyName,
    required this.lastUpdatedAt,
    required this.performance,
    this.hotelPulse,
    this.attention,
    this.approvals,
    this.revenueTrend,
    this.arrivals,
    this.guestPulse,
    this.operationsPulse,
    this.executiveBrief,
  });
}

class ApprovalSummary {
  final int pendingCount;
  final double totalAmount;
  final List<ApprovalData> items;

  ApprovalSummary({
    required this.pendingCount,
    required this.totalAmount,
    required this.items,
  });
}

class PerformanceData {
  final double todayRevenue;
  final double revenueTrendPercent;
  final double occupancyPercent;
  final double occupancyTrendPercent;
  final double adr;
  final double adrTrendPercent;
  final double revpar;
  final double revparTrendPercent;

  PerformanceData({
    required this.todayRevenue,
    required this.revenueTrendPercent,
    required this.occupancyPercent,
    required this.occupancyTrendPercent,
    required this.adr,
    required this.adrTrendPercent,
    required this.revpar,
    required this.revparTrendPercent,
  });
}

class HotelPulse {
  final int totalRooms;
  final int occupiedRooms;
  final int vacantRooms;
  final int outOfOrderRooms;
  final int arrivalsToday;
  final int departuresToday;
  final int inHouseGuests;
  final int vipArrivals;

  HotelPulse({
    required this.totalRooms,
    required this.occupiedRooms,
    required this.vacantRooms,
    required this.outOfOrderRooms,
    required this.arrivalsToday,
    required this.departuresToday,
    required this.inHouseGuests,
    required this.vipArrivals,
  });
}

class AlertData {
  final String id;
  final String priority; // 'P0', 'P1', 'P2', 'P3'
  final String title;
  final String summary;
  final String category;

  AlertData({
    required this.id,
    required this.priority,
    required this.title,
    required this.summary,
    required this.category,
  });
}

class ApprovalData {
  final String id;
  final String type;
  final String title;
  final double amount;
  final String requestedBy;
  final String department;
  final DateTime createdAt;
  final String priority;
  final String status;

  ApprovalData({
    required this.id,
    required this.type,
    required this.title,
    required this.amount,
    required this.requestedBy,
    required this.department,
    required this.createdAt,
    required this.priority,
    required this.status,
  });
}

class RevenueTrend {
  final double last7DaysRevenue;
  final double trendPercent;
  final List<double> dailyRevenueData; // 7 items for sparkline

  RevenueTrend({
    required this.last7DaysRevenue,
    required this.trendPercent,
    required this.dailyRevenueData,
  });
}

class ArrivalData {
  final String id;
  final String guestName;
  final String roomNumber;
  final String status; // 'VIP', 'Corporate', 'Repeat guest'
  final int nights;
  final bool isVip;

  ArrivalData({
    required this.id,
    required this.guestName,
    required this.roomNumber,
    required this.status,
    required this.nights,
    this.isVip = false,
  });
}

class GuestPulse {
  final int vipCount;
  final int openComplaints;
  final int resolvedRequests;
  final double guestRating;
  final AlertData? criticalExperienceAlert;

  GuestPulse({
    required this.vipCount,
    required this.openComplaints,
    required this.resolvedRequests,
    required this.guestRating,
    this.criticalExperienceAlert,
  });
}

enum DepartmentStatus { normal, attention, critical }

class OperationsPulse {
  final DepartmentStatus frontDeskStatus;
  final String frontDeskMessage;
  
  final DepartmentStatus housekeepingStatus;
  final String housekeepingMessage;
  
  final DepartmentStatus maintenanceStatus;
  final String maintenanceMessage;
  
  final DepartmentStatus fbStatus;
  final String fbMessage;

  OperationsPulse({
    required this.frontDeskStatus,
    required this.frontDeskMessage,
    required this.housekeepingStatus,
    required this.housekeepingMessage,
    required this.maintenanceStatus,
    required this.maintenanceMessage,
    required this.fbStatus,
    required this.fbMessage,
  });
}

class ExecutiveBrief {
  final String title;
  final String summary;

  ExecutiveBrief({
    required this.title,
    required this.summary,
  });
}

class RoomDashboardData {
  final PropertyInfo property;
  final DateTime businessDate;
  final DateTime generatedAt;
  final RoomOverview overview;
  final List<RoomItem> rooms;

  RoomDashboardData({
    required this.property,
    required this.businessDate,
    required this.generatedAt,
    required this.overview,
    required this.rooms,
  });
}

class PropertyInfo {
  final String id;
  final String name;
  final String timezone;

  PropertyInfo({
    required this.id,
    required this.name,
    required this.timezone,
  });
}

class RoomOverview {
  final int total;
  final int occupied;
  final int vacant;
  final int ready;
  final int dirty;
  final int outOfOrder;
  final int outOfService;

  RoomOverview({
    required this.total,
    required this.occupied,
    required this.vacant,
    required this.ready,
    required this.dirty,
    required this.outOfOrder,
    required this.outOfService,
  });
}

class RoomTypeInfo {
  final String id;
  final String name;

  RoomTypeInfo({
    required this.id,
    required this.name,
  });
}

class RoomItem {
  final String id;
  final String number;
  final RoomTypeInfo roomType;
  final String displayStatus;
  final String availabilityStatus;
  final String housekeepingStatus;
  final String maintenanceStatus;
  final String? contextualNote;

  RoomItem({
    required this.id,
    required this.number,
    required this.roomType,
    required this.displayStatus,
    required this.availabilityStatus,
    required this.housekeepingStatus,
    required this.maintenanceStatus,
    this.contextualNote,
  });
}

class RoomDetailsData {
  final PropertyInfo property;
  final DateTime businessDate;
  final DateTime generatedAt;
  final RoomItem room;
  final String sellability;
  final CurrentGuestInfo? currentGuest;
  final NextArrivalInfo? nextArrival;
  final HousekeepingInfo housekeeping;
  final MaintenanceInfo? maintenance;
  final List<TimelineEvent> timeline;
  final ManagementAttention? managementAttention;

  RoomDetailsData({
    required this.property,
    required this.businessDate,
    required this.generatedAt,
    required this.room,
    required this.sellability,
    this.currentGuest,
    this.nextArrival,
    required this.housekeeping,
    this.maintenance,
    required this.timeline,
    this.managementAttention,
  });
}

class CurrentGuestInfo {
  final String? name;
  final String? vipLevel;
  final DateTime checkIn;
  final DateTime checkOut;
  final double? folioBalance;

  CurrentGuestInfo({
    this.name,
    this.vipLevel,
    required this.checkIn,
    required this.checkOut,
    this.folioBalance,
  });
}

class NextArrivalInfo {
  final String reservationId;
  final String? guestName;
  final DateTime arrivalDate;
  final String? arrivalTime;
  final int nights;
  final String status;

  NextArrivalInfo({
    required this.reservationId,
    this.guestName,
    required this.arrivalDate,
    this.arrivalTime,
    required this.nights,
    required this.status,
  });
}

class HousekeepingInfo {
  final String status;
  final DateTime? lastUpdatedAt;
  final String? assignedTo;

  HousekeepingInfo({
    required this.status,
    this.lastUpdatedAt,
    this.assignedTo,
  });
}

class MaintenanceInfo {
  final String status;
  final String priority;
  final String reason;
  final DateTime? reportedAt;
  final DateTime? expectedResolutionAt;

  MaintenanceInfo({
    required this.status,
    required this.priority,
    required this.reason,
    this.reportedAt,
    this.expectedResolutionAt,
  });
}

class TimelineEvent {
  final String type;
  final String title;
  final String subtitle;
  final DateTime timestamp;

  TimelineEvent({
    required this.type,
    required this.title,
    required this.subtitle,
    required this.timestamp,
  });
}

class ManagementAttention {
  final String type; // 'WARNING' | 'CRITICAL'
  final String message;

  ManagementAttention({required this.type, required this.message});

  factory ManagementAttention.fromJson(Map<String, dynamic> json) {
    return ManagementAttention(
      type: json['type'] as String,
      message: json['message'] as String,
    );
  }
}

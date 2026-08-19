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

  RoomItem({
    required this.id,
    required this.number,
    required this.roomType,
    required this.displayStatus,
    required this.availabilityStatus,
    required this.housekeepingStatus,
    required this.maintenanceStatus,
  });
}

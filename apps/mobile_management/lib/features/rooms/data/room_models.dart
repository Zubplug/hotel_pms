
class MobileRoomDetailedStatus {
  final String id;
  final String number;
  final String roomTypeName;
  final String displayStatus;
  final String availabilityStatus;
  final String housekeepingStatus;
  final String maintenanceStatus;
  final String? contextualNote;
  final MobileRoomGuest? guest;
  final MobileRoomNextArrival? nextArrival;
  final List<String> indicators;

  MobileRoomDetailedStatus({
    required this.id,
    required this.number,
    required this.roomTypeName,
    required this.displayStatus,
    required this.availabilityStatus,
    required this.housekeepingStatus,
    required this.maintenanceStatus,
    this.contextualNote,
    this.guest,
    this.nextArrival,
    required this.indicators,
  });

  factory MobileRoomDetailedStatus.fromJson(Map<String, dynamic> json) {
    return MobileRoomDetailedStatus(
      id: json['id'],
      number: json['number'],
      roomTypeName: json['roomType']['name'],
      displayStatus: json['displayStatus'],
      availabilityStatus: json['availabilityStatus'],
      housekeepingStatus: json['housekeepingStatus'],
      maintenanceStatus: json['maintenanceStatus'] ?? 'NONE',
      contextualNote: json['contextualNote'],
      guest: json['guest'] != null ? MobileRoomGuest.fromJson(json['guest']) : null,
      nextArrival: json['nextArrival'] != null
          ? MobileRoomNextArrival.fromJson(json['nextArrival'])
          : null,
      indicators: List<String>.from(json['indicators'] ?? []),
    );
  }
}

class MobileRoomGuest {
  final String name;
  final int guests;
  final DateTime checkIn;
  final DateTime checkOut;

  MobileRoomGuest({
    required this.name,
    required this.guests,
    required this.checkIn,
    required this.checkOut,
  });

  factory MobileRoomGuest.fromJson(Map<String, dynamic> json) {
    return MobileRoomGuest(
      name: json['name'],
      guests: json['guests'] ?? 1,
      checkIn: DateTime.parse(json['checkIn']),
      checkOut: DateTime.parse(json['checkOut']),
    );
  }
}

class MobileRoomNextArrival {
  final String arrivalDate;
  final String? arrivalTime;
  final String status;

  MobileRoomNextArrival({
    required this.arrivalDate,
    this.arrivalTime,
    required this.status,
  });

  factory MobileRoomNextArrival.fromJson(Map<String, dynamic> json) {
    return MobileRoomNextArrival(
      arrivalDate: json['arrivalDate'],
      arrivalTime: json['arrivalTime'],
      status: json['status'],
    );
  }
}

class RoomsOverviewData {
  final int total;
  final int occupied;
  final int vacant;
  final int ready;
  final int dirty;
  final int outOfOrder;
  final int outOfService;

  RoomsOverviewData({
    required this.total,
    required this.occupied,
    required this.vacant,
    required this.ready,
    required this.dirty,
    required this.outOfOrder,
    required this.outOfService,
  });

  factory RoomsOverviewData.fromJson(Map<String, dynamic> json) {
    return RoomsOverviewData(
      total: json['total'] ?? 0,
      occupied: json['occupied'] ?? 0,
      vacant: json['vacant'] ?? 0,
      ready: json['ready'] ?? 0,
      dirty: json['dirty'] ?? 0,
      outOfOrder: json['outOfOrder'] ?? 0,
      outOfService: json['outOfService'] ?? 0,
    );
  }
}

class ExecutiveRoomsData {
  final RoomsOverviewData overview;
  final List<MobileRoomDetailedStatus> rooms;
  final DateTime lastUpdated;
  final String businessDate;

  ExecutiveRoomsData({
    required this.overview,
    required this.rooms,
    required this.lastUpdated,
    required this.businessDate,
  });

  factory ExecutiveRoomsData.fromJson(Map<String, dynamic> json) {
    return ExecutiveRoomsData(
      overview: RoomsOverviewData.fromJson(json['overview']),
      rooms: (json['rooms'] as List)
          .map((r) => MobileRoomDetailedStatus.fromJson(r))
          .toList(),
      lastUpdated: DateTime.parse(json['lastUpdated'] ?? json['generatedAt']),
      businessDate: json['businessDate'],
    );
  }
}

class MobileFolioData {
  final double totalCharges;
  final double paid;
  final double credit;
  final double balance;

  MobileFolioData({
    required this.totalCharges,
    required this.paid,
    required this.credit,
    required this.balance,
  });

  factory MobileFolioData.fromJson(Map<String, dynamic> json) {
    return MobileFolioData(
      totalCharges: (json['totalCharges'] ?? 0).toDouble(),
      paid: (json['paid'] ?? 0).toDouble(),
      credit: (json['credit'] ?? 0).toDouble(),
      balance: (json['balance'] ?? 0).toDouble(),
    );
  }
}

class RoomDetailsData {
  final Map<String, dynamic> rawJson;

  RoomDetailsData(this.rawJson);

  factory RoomDetailsData.fromJson(Map<String, dynamic> json) {
    return RoomDetailsData(json);
  }

  // Helper getters
  String get id => rawJson['room']['id'];
  String get number => rawJson['room']['number'];
  String get roomTypeName => rawJson['room']['roomType']['name'];
  String get displayStatus => rawJson['room']['displayStatus'];
  String get availabilityStatus => rawJson['room']['availabilityStatus'];
  String get housekeepingStatus => rawJson['room']['housekeepingStatus'];
  String get maintenanceStatus => rawJson['room']['maintenanceStatus'] ?? 'NONE';
  String? get contextualNote => rawJson['room']['contextualNote'];

  // Current Guest
  String? get currentGuestName => rawJson['currentGuest']?['name'];
  int get currentGuestCount => rawJson['currentGuest']?['guests'] ?? 1;
  String? get currentGuestCheckIn => rawJson['currentGuest']?['checkIn'];
  String? get currentGuestCheckOut => rawJson['currentGuest']?['checkOut'];
  MobileFolioData? get folio => rawJson['currentGuest']?['folio'] != null 
    ? MobileFolioData.fromJson(rawJson['currentGuest']['folio']) 
    : null;

  // Next Arrival
  String? get nextArrivalName => rawJson['nextArrival']?['guest']?['name'];
  String? get nextArrivalDate => rawJson['nextArrival']?['arrivalDate'];
  String? get nextArrivalStatus => rawJson['nextArrival']?['status'];
  
  // Timelines
  List<dynamic> get timeline => rawJson['timeline'] ?? [];
}

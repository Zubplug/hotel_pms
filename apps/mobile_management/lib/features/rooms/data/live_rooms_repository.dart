import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../presentation/models/room_data.dart';
import 'rooms_repository.dart';

class LiveRoomsRepository implements RoomsRepository {
  final Dio _dio;
  static const _cacheKey = 'executive_rooms_cache';

  LiveRoomsRepository({required Dio dio}) : _dio = dio;

  @override
  Future<RoomDashboardData> fetchRoomsData() async {
    final prefs = await SharedPreferences.getInstance();

    try {
      final response = await _dio.get('/mobile/v1/executive/rooms');

      if (response.statusCode == 200) {
        final data = response.data['data'] ?? response.data;
        await prefs.setString(_cacheKey, jsonEncode(data));
        return _parseData(data);
      }
      throw Exception('Rooms API returned status ${response.statusCode}');
    } catch (e) {
      // Fallback to cache on network error only
      final cachedData = prefs.getString(_cacheKey);
      if (cachedData != null) {
        return _parseData(jsonDecode(cachedData));
      }
      rethrow;
    }
  }

  RoomDashboardData _parseData(Map<String, dynamic> data) {
    final property = data['property'];
    if (property == null) throw Exception('API response missing property field');

    final businessDate = data['businessDate'];
    if (businessDate == null) throw Exception('API response missing businessDate field');

    return RoomDashboardData(
      property: PropertyInfo(
        id: property['id'] as String,
        name: property['name'] as String,
        timezone: property['timezone'] as String,
      ),
      businessDate: DateTime.parse(businessDate as String),
      generatedAt: DateTime.parse(data['generatedAt'] as String),
      overview: _parseOverview(data['overview']),
      rooms: _parseRooms(data['rooms']),
    );
  }

  RoomOverview _parseOverview(Map<String, dynamic>? data) {
    if (data == null) throw Exception('API response missing overview field');
    return RoomOverview(
      total: data['total'] as int,
      occupied: data['occupied'] as int,
      vacant: data['vacant'] as int,
      ready: data['ready'] as int,
      dirty: data['dirty'] as int,
      outOfOrder: data['outOfOrder'] as int,
      outOfService: data['outOfService'] as int,
    );
  }

  List<RoomItem> _parseRooms(List<dynamic>? data) {
    if (data == null) throw Exception('API response missing rooms field');
    return data.map((item) => _parseRoomItem(item as Map<String, dynamic>)).toList();
  }

  @override
  Future<RoomDetailsData> getRoomDetails(String roomId) async {
    final response = await _dio.get('/mobile/v1/executive/rooms/$roomId');

    if (response.statusCode == 200) {
      final data = response.data['data'] ?? response.data;
      return _parseRoomDetails(data as Map<String, dynamic>);
    }
    throw Exception('Room details API returned status ${response.statusCode}');
  }

  RoomDetailsData _parseRoomDetails(Map<String, dynamic> data) {
    final property = data['property'];
    if (property == null) throw Exception('Room details API response missing property field');

    final businessDate = data['businessDate'];
    if (businessDate == null) throw Exception('Room details API response missing businessDate field');

    final room = data['room'];
    if (room == null) throw Exception('Room details API response missing room field');

    return RoomDetailsData(
      property: PropertyInfo(
        id: property['id'] as String,
        name: property['name'] as String,
        timezone: property['timezone'] as String,
      ),
      businessDate: DateTime.parse(businessDate as String),
      room: _parseRoomItem(room as Map<String, dynamic>),
      sellability: room['sellability'] as String,
      currentGuest: data['currentGuest'] != null
          ? _parseCurrentGuest(data['currentGuest'] as Map<String, dynamic>)
          : null,
      nextArrival: data['nextArrival'] != null
          ? _parseNextArrival(data['nextArrival'] as Map<String, dynamic>)
          : null,
      housekeeping: _parseHousekeeping(data['housekeeping'] as Map<String, dynamic>?),
      maintenance: data['maintenance'] != null
          ? _parseMaintenance(data['maintenance'] as Map<String, dynamic>)
          : null,
      timeline: _parseTimeline(data['timeline'] as List<dynamic>?),
    );
  }

  RoomItem _parseRoomItem(Map<String, dynamic> item) {
    final roomType = item['roomType'];
    if (roomType == null) throw Exception('Room item missing roomType field');

    return RoomItem(
      id: item['id'] as String,
      number: item['number'] as String,
      roomType: RoomTypeInfo(
        id: roomType['id'] as String,
        name: roomType['name'] as String,
      ),
      displayStatus: item['displayStatus'] as String,
      availabilityStatus: item['availabilityStatus'] as String,
      housekeepingStatus: item['housekeepingStatus'] as String,
      maintenanceStatus: item['maintenanceStatus'] as String,
    );
  }

  CurrentGuestInfo _parseCurrentGuest(Map<String, dynamic> data) {
    return CurrentGuestInfo(
      name: data['name'] as String?,
      vipLevel: data['vipLevel'] as String?,
      checkIn: DateTime.parse(data['checkIn'] as String),
      checkOut: DateTime.parse(data['checkOut'] as String),
      folioBalance: (data['folioBalance'] as num?)?.toDouble(),
    );
  }

  NextArrivalInfo _parseNextArrival(Map<String, dynamic> data) {
    if (data['reservationId'] == null) {
      throw Exception('Next arrival missing reservationId');
    }
    if (data['arrivalDate'] == null) {
      throw Exception('Next arrival missing arrivalDate');
    }
    return NextArrivalInfo(
      reservationId: data['reservationId'] as String,
      guestName: (data['guest'] as Map<String, dynamic>?)?['name'] as String?,
      arrivalDate: DateTime.parse(data['arrivalDate'] as String),
      arrivalTime: data['arrivalTime'] as String?,
      nights: data['nights'] as int,
    );
  }

  HousekeepingInfo _parseHousekeeping(Map<String, dynamic>? data) {
    if (data == null) throw Exception('Room details API response missing housekeeping field');
    if (data['status'] == null) throw Exception('Housekeeping missing status field');
    return HousekeepingInfo(
      status: data['status'] as String,
      lastUpdatedAt: data['lastUpdatedAt'] != null
          ? DateTime.parse(data['lastUpdatedAt'] as String)
          : null,
      assignedTo: data['assignedTo'] as String?,
    );
  }

  MaintenanceInfo _parseMaintenance(Map<String, dynamic> data) {
    if (data['status'] == null) throw Exception('Maintenance missing status field');
    if (data['reason'] == null) throw Exception('Maintenance missing reason field');
    return MaintenanceInfo(
      status: data['status'] as String,
      priority: data['priority'] as String,
      reason: data['reason'] as String,
      reportedAt: data['reportedAt'] != null
          ? DateTime.parse(data['reportedAt'] as String)
          : null,
      expectedResolutionAt: data['expectedResolutionAt'] != null
          ? DateTime.parse(data['expectedResolutionAt'] as String)
          : null,
    );
  }

  List<TimelineEvent> _parseTimeline(List<dynamic>? data) {
    if (data == null) return [];
    return data.map((item) {
      final event = item as Map<String, dynamic>;
      if (event['type'] == null) throw Exception('Timeline event missing type field');
      if (event['timestamp'] == null) throw Exception('Timeline event missing timestamp field');
      return TimelineEvent(
        type: event['type'] as String,
        title: event['title'] as String,
        subtitle: event['subtitle'] as String? ?? '',
        timestamp: DateTime.parse(event['timestamp'] as String),
      );
    }).toList();
  }
}

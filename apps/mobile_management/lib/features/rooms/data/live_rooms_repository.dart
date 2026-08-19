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
        // Save to standard SharedPreferences (not secure storage, as this is public operational data)
        await prefs.setString(_cacheKey, jsonEncode(data));
        return _parseData(data);
      }
      throw Exception('Failed to load rooms data');
    } catch (e) {
      // Fallback to cache on network error
      final cachedData = prefs.getString(_cacheKey);
      if (cachedData != null) {
        return _parseData(jsonDecode(cachedData));
      }
      rethrow;
    }
  }

  RoomDashboardData _parseData(Map<String, dynamic> data) {
    return RoomDashboardData(
      property: PropertyInfo(
        id: data['property']?['id'] ?? '',
        name: data['property']?['name'] ?? 'LodgeCore Property',
        timezone: data['property']?['timezone'] ?? 'UTC',
      ),
      businessDate: DateTime.parse(data['businessDate'] ?? DateTime.now().toIso8601String()),
      generatedAt: DateTime.parse(data['generatedAt'] ?? DateTime.now().toIso8601String()),
      overview: _parseOverview(data['overview']),
      rooms: _parseRooms(data['rooms']),
    );
  }

  RoomOverview _parseOverview(Map<String, dynamic>? data) {
    if (data == null) {
      return RoomOverview(total: 0, occupied: 0, vacant: 0, ready: 0, dirty: 0, outOfOrder: 0, outOfService: 0);
    }
    return RoomOverview(
      total: data['total'] ?? 0,
      occupied: data['occupied'] ?? 0,
      vacant: data['vacant'] ?? 0,
      ready: data['ready'] ?? 0,
      dirty: data['dirty'] ?? 0,
      outOfOrder: data['outOfOrder'] ?? 0,
      outOfService: data['outOfService'] ?? 0,
    );
  }

  List<RoomItem> _parseRooms(List<dynamic>? data) {
    if (data == null) return [];
    
    return data.map((item) {
      return RoomItem(
        id: item['id'] ?? '',
        number: item['number'] ?? '',
        roomType: RoomTypeInfo(
          id: item['roomType']?['id'] ?? '',
          name: item['roomType']?['name'] ?? '',
        ),
        displayStatus: item['displayStatus'] ?? 'UNKNOWN',
        availabilityStatus: item['availabilityStatus'] ?? 'UNKNOWN',
        housekeepingStatus: item['housekeepingStatus'] ?? 'UNKNOWN',
        maintenanceStatus: item['maintenanceStatus'] ?? 'NONE',
      );
    }).toList();
  }
}

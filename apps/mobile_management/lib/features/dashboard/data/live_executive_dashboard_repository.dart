import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../presentation/models/executive_dashboard_data.dart';
import 'executive_dashboard_repository.dart';

class LiveExecutiveDashboardRepository implements ExecutiveDashboardRepository {
  final Dio _dio;
  final FlutterSecureStorage _storage;
  static const _cacheKey = 'manager_dashboard_cache';

  LiveExecutiveDashboardRepository({required Dio dio, required FlutterSecureStorage storage}) 
    : _dio = dio, _storage = storage;

  @override
  Future<ExecutiveDashboardData> fetchDashboardData() async {
    try {
      final response = await _dio.get('/mobile/v1/executive/dashboard');
      if (response.statusCode == 200) {
        final data = response.data['data'] ?? response.data;
        // Save to cache
        await _storage.write(key: _cacheKey, value: jsonEncode(data));
        return _parseData(data);
      }
      throw Exception('Failed to load dashboard data');
    } catch (e) {
      // Fallback to cache on network error
      final cachedData = await _storage.read(key: _cacheKey);
      if (cachedData != null) {
        return _parseData(jsonDecode(cachedData));
      }
      rethrow;
    }
  }

  ExecutiveDashboardData _parseData(Map<String, dynamic> data) {
    return ExecutiveDashboardData(
      propertyName: data['property']?['name'] ?? 'LodgeCore',
      lastUpdatedAt: DateTime.parse(data['generatedAt'] ?? DateTime.now().toIso8601String()),
      performance: _parsePerformance(data['performance']),
      hotelPulse: _parseHotelPulse(data['hotelPulse']),
      attention: _parseAlerts(data['attention']),
      approvals: _parseApprovals(data['approvals']),
      revenueTrend: _parseRevenueTrend(data['revenueTrend']),
      arrivals: _parseArrivals(data['arrivals']),
      guestPulse: _parseGuestPulse(data['guestPulse']),
      operationsPulse: _parseOperationsPulse(data['operationsPulse']),
      executiveBrief: _parseExecutiveBrief(data['executiveBrief']),
    );
  }

  PerformanceData _parsePerformance(Map<String, dynamic>? data) {
    if (data == null) {
      return PerformanceData(
        todayRevenue: 0, revenueTrendPercent: 0, occupancyPercent: 0,
        occupancyTrendPercent: 0, adr: 0, adrTrendPercent: 0,
        revpar: 0, revparTrendPercent: 0,
      );
    }
    return PerformanceData(
      todayRevenue: (data['revenue'] ?? 0).toDouble(),
      revenueTrendPercent: (data['revenueTrend'] ?? 0).toDouble(),
      occupancyPercent: (data['occupancy'] ?? 0).toDouble(),
      occupancyTrendPercent: (data['occupancyTrend'] ?? 0).toDouble(),
      adr: (data['adr'] ?? 0).toDouble(),
      adrTrendPercent: (data['adrTrend'] ?? 0).toDouble(),
      revpar: (data['revpar'] ?? 0).toDouble(),
      revparTrendPercent: (data['revparTrend'] ?? 0).toDouble(),
    );
  }

  HotelPulse? _parseHotelPulse(Map<String, dynamic>? data) {
    if (data == null) return null;
    return HotelPulse(
      totalRooms: data['totalRooms'] ?? 0,
      occupiedRooms: data['occupied'] ?? 0,
      vacantRooms: data['vacant'] ?? 0,
      outOfOrderRooms: data['outOfOrder'] ?? 0,
      arrivalsToday: data['arrivals'] ?? 0,
      departuresToday: data['departures'] ?? 0,
      inHouseGuests: data['inHouseGuests'] ?? 0,
      vipArrivals: data['vipArrivals'] ?? 0,
    );
  }

  List<AlertData>? _parseAlerts(List<dynamic>? data) {
    if (data == null) return null;
    return data.map((item) => AlertData(
      id: item['id'] ?? '',
      priority: item['priority'] ?? 'P3',
      title: item['title'] ?? '',
      summary: item['summary'] ?? '',
      category: item['category'] ?? '',
    )).toList();
  }

  ApprovalSummary? _parseApprovals(Map<String, dynamic>? data) {
    if (data == null) return null;
    final items = data['items'] as List?;
    return ApprovalSummary(
      pendingCount: data['pendingCount'] ?? 0,
      totalAmount: (data['totalAmount'] ?? 0).toDouble(),
      items: items?.map((item) => ApprovalData(
        id: item['id'] ?? '',
        type: item['type'] ?? '',
        title: item['title'] ?? '',
        amount: (item['amount'] ?? 0).toDouble(),
        requestedBy: item['requestedBy'] ?? '',
        department: item['department'] ?? '',
        createdAt: DateTime.parse(item['createdAt'] ?? DateTime.now().toIso8601String()),
        priority: item['priority'] ?? 'MEDIUM',
        status: item['status'] ?? 'PENDING',
      )).toList() ?? [],
    );
  }

  RevenueTrend? _parseRevenueTrend(Map<String, dynamic>? data) {
    if (data == null) return null;
    return RevenueTrend(
      last7DaysRevenue: (data['last7DaysRevenue'] ?? 0).toDouble(),
      trendPercent: (data['trendPercent'] ?? 0).toDouble(),
      dailyRevenueData: (data['dailyRevenueData'] as List?)?.map((e) => (e as num).toDouble()).toList() ?? [],
    );
  }

  List<ArrivalData>? _parseArrivals(List<dynamic>? data) {
    if (data == null) return null;
    return data.map((item) => ArrivalData(
      id: item['id'] ?? '',
      guestName: item['guestName'] ?? '',
      roomNumber: item['roomNumber'] ?? '',
      status: item['status'] ?? '',
      nights: item['nights'] ?? 0,
      isVip: item['isVip'] ?? false,
    )).toList();
  }

  GuestPulse? _parseGuestPulse(Map<String, dynamic>? data) {
    if (data == null) return null;
    return GuestPulse(
      vipCount: data['vipCount'] ?? 0,
      openComplaints: data['openComplaints'] ?? 0,
      resolvedRequests: data['resolvedRequests'] ?? 0,
      guestRating: (data['guestRating'] ?? 0).toDouble(),
      criticalExperienceAlert: null, // Parse if available
    );
  }

  OperationsPulse? _parseOperationsPulse(Map<String, dynamic>? data) {
    if (data == null) return null;
    return OperationsPulse(
      frontDeskStatus: _parseDeptStatus(data['frontDeskStatus']),
      frontDeskMessage: data['frontDeskMessage'] ?? '',
      housekeepingStatus: _parseDeptStatus(data['housekeepingStatus']),
      housekeepingMessage: data['housekeepingMessage'] ?? '',
      maintenanceStatus: _parseDeptStatus(data['maintenanceStatus']),
      maintenanceMessage: data['maintenanceMessage'] ?? '',
      fbStatus: _parseDeptStatus(data['fbStatus']),
      fbMessage: data['fbMessage'] ?? '',
    );
  }

  DepartmentStatus _parseDeptStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'CRITICAL': return DepartmentStatus.critical;
      case 'ATTENTION': return DepartmentStatus.attention;
      default: return DepartmentStatus.normal;
    }
  }

  ExecutiveBrief? _parseExecutiveBrief(Map<String, dynamic>? data) {
    if (data == null) return null;
    return ExecutiveBrief(
      title: data['title'] ?? '',
      summary: data['summary'] ?? '',
    );
  }
}

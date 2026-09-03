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
        return ExecutiveDashboardData.fromJson(data);
      }
      throw Exception('Failed to load dashboard data');
    } catch (e) {
      // Fallback to cache on network error
      final cachedData = await _storage.read(key: _cacheKey);
      if (cachedData != null) {
        return ExecutiveDashboardData.fromJson(jsonDecode(cachedData));
      }
      rethrow;
    }
  }
}

import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/storage/secure_storage_provider.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final storage = ref.watch(secureStorageProvider);
  return DashboardRepository(dio: dio, storage: storage);
});

class DashboardRepository {
  final Dio _dio;
  final FlutterSecureStorage _storage;
  static const _cacheKey = 'manager_dashboard_cache';

  DashboardRepository({required Dio dio, required FlutterSecureStorage storage}) 
    : _dio = dio, _storage = storage;

  Future<Map<String, dynamic>> fetchDashboardData() async {
    try {
      final response = await _dio.get('/mobile/v1/executive/dashboard');
      if (response.statusCode == 200) {
        final data = response.data['data'] ?? response.data;
        // Save to cache
        await _storage.write(key: _cacheKey, value: jsonEncode(data));
        return data as Map<String, dynamic>;
      }
      throw Exception('Failed to load dashboard data');
    } catch (e) {
      // Fallback to cache on network error
      final cachedData = await _storage.read(key: _cacheKey);
      if (cachedData != null) {
        return jsonDecode(cachedData) as Map<String, dynamic>;
      }
      rethrow;
    }
  }
}

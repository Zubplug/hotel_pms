import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../presentation/models/finance_data.dart';
import 'finance_repository.dart';

class LiveFinanceRepository implements FinanceRepository {
  final Dio _dio;
  static const _cacheKey = 'executive_finance_cache';

  LiveFinanceRepository({required Dio dio}) : _dio = dio;

  @override
  Future<FinanceDashboardData> fetchFinanceData({String period = 'TODAY'}) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheKey = '${_cacheKey}_$period';

    try {
      final response = await _dio.get('/mobile/v1/executive/finance', queryParameters: {'period': period});

      if (response.statusCode == 200) {
        final data = response.data;
        await prefs.setString(cacheKey, jsonEncode(data));
        return FinanceDashboardData.fromJson(data);
      }
      throw Exception('Finance API returned status ${response.statusCode}');
    } catch (e) {
      // Fallback to cache on network error
      final cachedData = prefs.getString(cacheKey);
      if (cachedData != null) {
        return FinanceDashboardData.fromJson(jsonDecode(cachedData));
      }
      rethrow;
    }
  }
}

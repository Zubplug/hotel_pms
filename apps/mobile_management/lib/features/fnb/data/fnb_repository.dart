import 'package:dio/dio.dart';
import '../presentation/models/fnb_dashboard_data.dart';

class FnbRepository {
  final Dio _dio;

  FnbRepository({required Dio dio}) : _dio = dio;

  Future<FnbDashboardData> fetchFnbDashboard() async {
    final response = await _dio.get('/mobile/v1/executive/fnb');
    if (response.statusCode == 200) {
      final data = response.data['data'] ?? response.data;
      return FnbDashboardData.fromJson(data as Map<String, dynamic>);
    }
    throw Exception('Failed to load F&B dashboard data');
  }
}

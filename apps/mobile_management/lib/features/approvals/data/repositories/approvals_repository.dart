import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';

final approvalsRepositoryProvider = Provider<ApprovalsRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return ApprovalsRepository(dio);
});

class ApprovalsRepository {
  final Dio _dio;

  ApprovalsRepository(this._dio);

  Future<List<dynamic>> fetchPendingApprovals() async {
    final response = await _dio.get('/manager/approvals');
    if (response.statusCode == 200) {
      return response.data['data'] as List<dynamic>;
    }
    throw Exception('Failed to fetch approvals');
  }

  Future<void> approveRequest(String id) async {
    final response = await _dio.post('/manager/approvals/$id/approve');
    if (response.statusCode != 200) {
      throw Exception('Failed to approve request');
    }
  }

  Future<void> rejectRequest(String id) async {
    final response = await _dio.post('/manager/approvals/$id/reject');
    if (response.statusCode != 200) {
      throw Exception('Failed to reject request');
    }
  }
}

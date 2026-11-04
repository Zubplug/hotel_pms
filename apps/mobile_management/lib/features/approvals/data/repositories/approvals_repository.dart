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
    final response = await _dio.get('/mobile/v1/executive/approvals');
    if (response.statusCode == 200) {
      final payload = response.data;
      if (payload is List<dynamic>) return payload;
      if (payload is Map<String, dynamic>) {
        final data = payload['data'];
        if (data is List<dynamic>) return data;
        if (data is Map<String, dynamic> &&
            data['approvals'] is List<dynamic>) {
          return data['approvals'] as List<dynamic>;
        }
        if (payload['approvals'] is List<dynamic>) {
          return payload['approvals'] as List<dynamic>;
        }
      }
      return const [];
    }
    throw Exception('Failed to fetch approvals');
  }

  Future<void> approveRequest(
    String id, {
    String source = 'APPROVAL_REQUEST',
  }) async {
    final response = await _dio.post(
      '/mobile/v1/executive/approvals/$id',
      data: {'action': 'APPROVE', 'source': source},
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to approve request');
    }
  }

  Future<void> rejectRequest(
    String id,
    String comment, {
    String source = 'APPROVAL_REQUEST',
  }) async {
    final response = await _dio.post(
      '/mobile/v1/executive/approvals/$id',
      data: {'action': 'REJECT', 'comments': comment, 'source': source},
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to reject request');
    }
  }
}

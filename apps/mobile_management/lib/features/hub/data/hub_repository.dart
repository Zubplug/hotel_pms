import 'package:dio/dio.dart';
import 'hub_model.dart';

class HubRepository {
  final Dio _dio;

  HubRepository(this._dio);

  Future<HubData> fetchHubData({String propertyId = 'ALL_AUTHORIZED'}) async {
    try {
      final response = await _dio.get(
        '/api/mobile/v1/executive/hub',
        queryParameters: {
          if (propertyId != 'ALL_AUTHORIZED') 'propertyId': propertyId,
        },
      );
      return HubData.fromJson(response.data['data']);
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(e.response?.data['message'] ?? 'Failed to load hub data');
      }
      throw Exception('Network error occurred');
    } catch (e) {
      throw Exception('Failed to load hub data: \$e');
    }
  }

  Future<void> approveRequest(String approvalId) async {
    try {
      await _dio.post('/api/mobile/v1/executive/approvals/\$approvalId', data: {
        'action': 'APPROVE',
      });
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(e.response?.data['message'] ?? 'Failed to approve request');
      }
      throw Exception('Network error occurred');
    } catch (e) {
      throw Exception('Failed to approve request: \$e');
    }
  }

  Future<void> rejectRequest(String approvalId, String comments) async {
    try {
      await _dio.post('/api/mobile/v1/executive/approvals/\$approvalId', data: {
        'action': 'REJECT',
        'comments': comments,
      });
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(e.response?.data['message'] ?? 'Failed to reject request');
      }
      throw Exception('Network error occurred');
    } catch (e) {
      throw Exception('Failed to reject request: \$e');
    }
  }
}

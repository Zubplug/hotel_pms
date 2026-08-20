import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'hub_model.dart';

class HubRepository {
  final Dio _dio;

  HubRepository(this._dio);

  Future<HubData> fetchHubData({String propertyId = 'ALL_AUTHORIZED'}) async {
    try {
      final response = await _dio.get(
        '/mobile/v1/executive/hub',
        queryParameters: {
          if (propertyId != 'ALL_AUTHORIZED') 'propertyId': propertyId,
        },
      );
      return HubData.fromJson(response.data['data']);
    } on DioException catch (e) {
      debugPrint('[HubRepository] DioException: ${e.message}');
      debugPrint('[HubRepository] URL: ${e.requestOptions.uri}');
      debugPrint('[HubRepository] Status: ${e.response?.statusCode}');
      debugPrint('[HubRepository] Response Data: ${e.response?.data}');
      if (e.response != null) {
        throw Exception(e.response?.data['message'] ?? e.response?.data['error'] ?? 'Failed to load hub data (HTTP ${e.response?.statusCode})');
      }
      throw Exception('Network error occurred: ${e.message}');
    } catch (e, stacktrace) {
      debugPrint('[HubRepository] Unknown Exception: $e');
      debugPrint('[HubRepository] Stacktrace: $stacktrace');
      throw Exception('Failed to load hub data: $e');
    }
  }

  Future<void> approveRequest(String approvalId) async {
    try {
      await _dio.post('/mobile/v1/executive/approvals/$approvalId', data: {
        'action': 'APPROVE',
      });
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(e.response?.data['message'] ?? 'Failed to approve request');
      }
      throw Exception('Network error occurred');
    } catch (e) {
      throw Exception('Failed to approve request: $e');
    }
  }

  Future<void> rejectRequest(String approvalId, String comments) async {
    try {
      await _dio.post('/mobile/v1/executive/approvals/$approvalId', data: {
        'action': 'REJECT',
        'comments': comments,
      });
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(e.response?.data['message'] ?? 'Failed to reject request');
      }
      throw Exception('Network error occurred');
    } catch (e) {
      throw Exception('Failed to reject request: $e');
    }
  }
}

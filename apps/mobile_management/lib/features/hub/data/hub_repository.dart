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
        throw Exception(
          e.response?.data['message'] ??
              e.response?.data['error'] ??
              'Failed to load hub data (HTTP ${e.response?.statusCode})',
        );
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
      await _dio.post(
        '/mobile/v1/executive/approvals/$approvalId',
        data: {'action': 'APPROVE'},
      );
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(
          e.response?.data['message'] ?? 'Failed to approve request',
        );
      }
      throw Exception('Network error occurred');
    } catch (e) {
      throw Exception('Failed to approve request: $e');
    }
  }

  Future<void> rejectRequest(String approvalId, String comments) async {
    try {
      await _dio.post(
        '/mobile/v1/executive/approvals/$approvalId',
        data: {'action': 'REJECT', 'comments': comments},
      );
    } on DioException catch (e) {
      if (e.response != null) {
        throw Exception(
          e.response?.data['message'] ?? 'Failed to reject request',
        );
      }
      throw Exception('Network error occurred');
    } catch (e) {
      throw Exception('Failed to reject request: $e');
    }
  }

  Future<Map<String, dynamic>> fetchReservations({
    String? propertyId,
    String? date,
  }) async {
    final response = await _dio.get(
      '/mobile/v1/executive/reservations',
      queryParameters: {
        if (propertyId != null) 'propertyId': propertyId,
        if (date != null) 'date': date,
      },
    );
    return Map<String, dynamic>.from(response.data['data'] as Map);
  }

  Future<Map<String, dynamic>> fetchReservationDetails(
    String id, {
    String? propertyId,
  }) async {
    final response = await _dio.get(
      '/mobile/v1/executive/reservations',
      queryParameters: {
        'reservationId': id,
        if (propertyId != null) 'propertyId': propertyId,
      },
    );
    return Map<String, dynamic>.from(
      response.data['data']['reservation'] as Map,
    );
  }

  Future<void> checkoutToCityLedger(
    String reservationId, {
    required String reason,
  }) async {
    try {
      await _dio.post(
        '/v1/reservations/$reservationId/check-out',
        data: {'forceSkipper': true, 'reason': reason},
      );
    } on DioException catch (error) {
      final body = error.response?.data;
      final nested = body is Map ? body['error'] : null;
      final message = nested is Map
          ? nested['message']
          : body is Map
          ? body['message']
          : null;
      throw Exception(
        message?.toString() ?? 'Unable to complete City Ledger checkout',
      );
    }
  }
}

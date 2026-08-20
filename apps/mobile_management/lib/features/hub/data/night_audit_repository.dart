import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';

class NightAuditPreview {
  final String timezone;
  final DateTime businessDate;
  final DateTime nextBusinessDate;
  final Map<String, dynamic>? audit;
  final int projectedStayovers;
  final int pendingArrivals;
  final int unresolvedFolios;
  final int openApprovals;
  final List<String> warnings;

  NightAuditPreview({
    required this.timezone,
    required this.businessDate,
    required this.nextBusinessDate,
    this.audit,
    required this.projectedStayovers,
    required this.pendingArrivals,
    required this.unresolvedFolios,
    required this.openApprovals,
    required this.warnings,
  });

  factory NightAuditPreview.fromJson(Map<String, dynamic> json) {
    return NightAuditPreview(
      timezone: json['timezone'],
      businessDate: DateTime.parse(json['businessDate']),
      nextBusinessDate: DateTime.parse(json['nextBusinessDate']),
      audit: json['audit'],
      projectedStayovers: json['projectedStayovers'] ?? 0,
      pendingArrivals: json['pendingArrivals'] ?? 0,
      unresolvedFolios: json['unresolvedFolios'] ?? 0,
      openApprovals: json['openApprovals'] ?? 0,
      warnings: List<String>.from(json['warnings'] ?? []),
    );
  }
}

class NightAuditRepository {
  final Dio _dio;

  NightAuditRepository(this._dio);

  Future<NightAuditPreview> getPreview(String propertyId) async {
    final response = await _dio.get(
      '/mobile/v1/executive/night-audit/preview',
      queryParameters: {'propertyId': propertyId},
    );
    return NightAuditPreview.fromJson(response.data['data']);
  }

  Future<Map<String, dynamic>> executeNightAudit(String propertyId) async {
    final response = await _dio.post(
      '/mobile/v1/executive/night-audit/execute',
      data: {'propertyId': propertyId},
    );
    return response.data['data'];
  }
}

final nightAuditRepositoryProvider = Provider<NightAuditRepository>((ref) {
  return NightAuditRepository(ref.watch(dioProvider));
});

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
    final operational = json['operational'] is Map
        ? Map<String, dynamic>.from(json['operational'] as Map)
        : const <String, dynamic>{};
    final financial = json['financial'] is Map
        ? Map<String, dynamic>.from(json['financial'] as Map)
        : const <String, dynamic>{};
    final businessDate = _parseDate(json['businessDate']) ?? DateTime.now();
    return NightAuditPreview(
      timezone: json['timezone']?.toString() ?? 'UTC',
      businessDate: businessDate,
      nextBusinessDate:
          _parseDate(json['nextBusinessDate']) ??
          businessDate.add(const Duration(days: 1)),
      audit: json['audit'] is Map
          ? Map<String, dynamic>.from(json['audit'] as Map)
          : null,
      projectedStayovers: _asInt(json['projectedStayovers']),
      pendingArrivals: _count(json['pendingArrivals'], operational['arrivals']),
      unresolvedFolios: _count(
        json['unresolvedFolios'],
        financial['openFolios'],
      ),
      openApprovals: _count(
        json['openApprovals'],
        financial['pendingDiscounts'],
      ),
      warnings: _asStringList(json['warnings']),
    );
  }

  static DateTime? _parseDate(dynamic value) =>
      value == null ? null : DateTime.tryParse(value.toString());

  static int _asInt(dynamic value) =>
      value is num ? value.toInt() : int.tryParse('$value') ?? 0;

  static int _listLength(dynamic value) => value is List ? value.length : 0;

  static int _count(dynamic primary, dynamic fallback) {
    final value = _asInt(primary);
    return value > 0 ? value : _listLength(fallback);
  }

  static List<String> _asStringList(dynamic value) => value is List
      ? value
            .where((item) => item != null)
            .map((item) => item.toString())
            .toList()
      : const [];
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

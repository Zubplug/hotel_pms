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

  Future<Map<String, dynamic>> getWorkflow(String propertyId) async {
    final response = await _dio.get(
      '/v1/night-audit/status',
      queryParameters: {'propertyId': propertyId},
    );
    final data = response.data is Map ? response.data['data'] : null;
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  Future<void> voidPosOrder({
    required String orderId,
    required String propertyId,
    required String reason,
  }) async {
    await _dio.post(
      '/v1/night-audit/resolve/void-pos-order/$orderId',
      data: {
        'propertyId': propertyId,
        'reason': reason,
        'investigationConfirmed': true,
      },
    );
  }

  Future<void> verifyTransaction({
    required String propertyId,
    required String transactionId,
    required String type,
    required String status,
    String? notes,
  }) async {
    await _dio.post(
      '/v1/night-audit/resolve/verify-transaction',
      data: {
        'propertyId': propertyId,
        'transactionId': transactionId,
        'type': type,
        'status': status,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        'idempotencyKey':
            'mobile-night-audit-$transactionId-${DateTime.now().millisecondsSinceEpoch}',
      },
    );
  }

  Future<void> verifyCheckInBypass({
    required String propertyId,
    required String bypassId,
    required String action,
    String? notes,
  }) async {
    await _dio.post(
      '/v1/night-audit/verify-checkin-bypass',
      data: {
        'propertyId': propertyId,
        'bypassId': bypassId,
        'action': action,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
  }

  Future<void> updateComplimentary({
    required String propertyId,
    required String recordId,
    required String status,
    String? rejectionReason,
  }) async {
    await _dio.patch(
      '/v1/financial-control/complimentary',
      data: {
        'propertyId': propertyId,
        'id': recordId,
        'status': status,
        if (rejectionReason != null && rejectionReason.trim().isNotEmpty)
          'rejectionReason': rejectionReason.trim(),
      },
    );
  }

  Future<void> reconcileRoom({
    required String roomId,
    required String expectedStatus,
    required String targetHousekeepingStatus,
  }) async {
    await _dio.post(
      '/v1/housekeeping/tasks',
      data: {
        'roomId': roomId,
        'action': 'RECONCILE',
        'pmsStatus': expectedStatus,
        'targetStatus': targetHousekeepingStatus,
        'idempotencyKey':
            'mobile-night-audit-room-$roomId-${DateTime.now().millisecondsSinceEpoch}',
      },
    );
  }

  Future<void> settlePosSession({
    required String sessionId,
    required double actualCash,
    String? reason,
  }) async {
    await _dio.post(
      '/v1/pos/sessions/$sessionId/settle',
      data: {
        'actualCash': actualCash,
        'authorizerId': null,
        'reason': reason?.trim() ?? '',
        'idempotencyKey':
            'mobile-night-audit-pos-session-$sessionId-${DateTime.now().millisecondsSinceEpoch}',
      },
    );
  }

  Future<void> closeFrontdeskShift({
    required String shiftId,
    required double declaredCash,
    String? reason,
  }) async {
    await _dio.post(
      '/v1/frontdesk/sessions/$shiftId/close',
      data: {
        'declaredCash': declaredCash,
        'reason': reason?.trim() ?? '',
        'idempotencyKey':
            'mobile-night-audit-frontdesk-$shiftId-${DateTime.now().millisecondsSinceEpoch}',
      },
    );
  }

  Future<void> resolveSyncConflict({
    required String conflictId,
    required String action,
  }) async {
    await _dio.post(
      '/v1/sync/conflicts/$conflictId/resolve',
      data: {
        'action': action,
        'resolutionComment': 'Night Audit mobile resolution: $action',
        'idempotencyKey':
            'mobile-night-audit-sync-$conflictId-${DateTime.now().millisecondsSinceEpoch}',
      },
    );
  }

  Future<void> reservationAction(
    String reservationId,
    String action, {
    Map<String, dynamic>? data,
  }) async {
    await _dio.post(
      '/v1/reservations/$reservationId/$action',
      data: {
        ...?data,
        'idempotencyKey':
            'mobile-night-audit-$action-$reservationId-${DateTime.now().millisecondsSinceEpoch}',
      },
    );
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

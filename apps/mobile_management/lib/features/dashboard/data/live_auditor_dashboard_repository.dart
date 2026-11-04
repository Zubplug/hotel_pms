import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../presentation/models/auditor_dashboard_data.dart';

class LiveAuditorDashboardRepository {
  final Dio _dio;
  final FlutterSecureStorage _storage;
  static const _cacheKey = 'auditor_dashboard_cache';

  LiveAuditorDashboardRepository({
    required Dio dio,
    required FlutterSecureStorage storage,
  }) : _dio = dio,
       _storage = storage;

  Future<AuditorDashboardData> fetchDashboardData(String propertyId) async {
    try {
      if (kDebugMode) {
        debugPrint(
          '[Night Audit] loading status for propertyId=$propertyId '
          'baseUrl=${_dio.options.baseUrl}',
        );
      }
      // AppConfig.apiBaseUrl already includes the `/api` prefix. Keep this
      // endpoint relative so production resolves to `/api/v1/...`.
      final response = await _dio.get(
        '/v1/night-audit/status',
        queryParameters: {'propertyId': propertyId},
      );

      if (response.statusCode == 200) {
        dynamic responseData = response.data;
        if (responseData is String) {
          try {
            responseData = jsonDecode(responseData);
          } catch (_) {}
        }

        final Map<String, dynamic> rawData =
            (responseData is Map && responseData.containsKey('data'))
            ? responseData['data']
            : (responseData is Map ? responseData : {});

        // Map the backend response to the AuditorDashboardData structure
        final mappedData = _mapBackendToAuditorData(rawData);

        // Save to cache
        await _storage.write(key: _cacheKey, value: jsonEncode(mappedData));
        return AuditorDashboardData.fromJson(mappedData);
      }
      throw Exception('Failed to load auditor dashboard data');
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[Night Audit] status request failed: $e');
      }
      // Fallback to cache on network error
      final cachedData = await _storage.read(key: _cacheKey);
      if (cachedData != null) {
        return AuditorDashboardData.fromJson(jsonDecode(cachedData));
      }
      rethrow;
    }
  }

  Map<String, dynamic> _mapBackendToAuditorData(Map<String, dynamic> data) {
    final auditState = data['auditState'] ?? 'NOT_STARTED';
    final businessDate = data['businessDate'] ?? '';
    final propertyName = data['property']?['name'] ?? '';
    final summary = data['summary'] ?? {};
    final operational = data['operational'] ?? {};
    final system = data['system'] ?? {};
    final cash = data['cash'] ?? {};
    final financial = data['financial'] ?? {};
    final fnb = data['fnb'] ?? {};
    final fnbExceptions = fnb['exceptions'] ?? {};
    final lastCompletedAudit = data['lastCompletedAudit'];
    final lastAuditRevenue = lastCompletedAudit is Map
        ? lastCompletedAudit['totalRevenue']
        : null;
    final lastAuditSnapshot = lastCompletedAudit is Map
        ? lastCompletedAudit['financialSnapshot']
        : null;
    final trend = data['analytics']?['trend'] is List
        ? (data['analytics']['trend'] as List)
        : const [];
    final priorAudit = trend.length > 1 ? trend[trend.length - 2] : null;
    final priorSnapshot = priorAudit is Map
        ? priorAudit['financialSnapshot']
        : null;

    return {
      'property': {'name': propertyName},
      'generatedAt': DateTime.now().toIso8601String(),
      'businessDate': businessDate,
      'auditStatus': {
        'state': auditState,
        'startedAt': data['activeAudit']?['startedAt'],
        'completedAt': data['currentAudit']?['completedAt'],
        'currentStep': data['activeAudit']?['status'] ?? '',
        'progressPercent': _calculateProgress(auditState),
        'lastSuccessfulAudit': data['property']?['lastAuditAt'],
        // The status API returns summary.blockers as a count, not an error
        // list. Keep the count in auditExceptions and only pass a list here.
        'blockingErrors': summary['blockers'] is List
            ? summary['blockers']
            : <String>[],
      },
      'auditExceptions': {
        'criticalCount': summary['blockers'] ?? 0,
        'warningCount': summary['warnings'] ?? 0,
      },
      'criticalDiscrepancies': {
        'roomStatusDiscrepancies': _listLength(
          operational['roomReconciliation'],
        ),
        'occupancyDiscrepancies':
            data['analytics']?['occupancyDiscrepancies'] ?? 0,
        'unpostedCharges': data['analytics']?['latePostings'] ?? 0,
        'openFolios': _listLength(financial['highBalances']), // Approximation
        'reservationsRequiringAttention':
            _listLength(operational['arrivals']) +
            _listLength(operational['departures']),
      },
      'cashReconciliation': {
        'openShifts': _listLength(system['openFrontdeskSessions']),
        'pendingHandovers': _listLength(cash['cashHandovers']),
        'unreconciledCash': (data['analytics']?['cashVariance'] ?? 0)
            .toDouble(),
        'posSessionsRequiringClosure': _listLength(system['openPosSessions']),
        'outstandingDeposits': _listLength(cash['bankDeposits']),
      },
      'analytics': {
        // The dashboard Revenue KPI represents the latest completed audit.
        // Fall back to live revenue when there is no completed audit yet.
        'revenue': _asDouble(lastAuditRevenue ?? data['analytics']?['revenue']),
        'adr': _asDouble(
          lastCompletedAudit is Map ? lastCompletedAudit['adr'] : null,
        ),
        'revpar': _asDouble(
          lastCompletedAudit is Map ? lastCompletedAudit['revpar'] : null,
        ),
        'netRevenue': _asDouble(
          lastAuditSnapshot is Map
              ? (lastAuditSnapshot['netRevenue'] ?? lastAuditRevenue)
              : lastAuditRevenue,
        ),
        'priorRevenue': _asDouble(
          priorAudit is Map ? priorAudit['totalRevenue'] : null,
        ),
        'priorAdr': _asDouble(priorAudit is Map ? priorAudit['adr'] : null),
        'priorRevpar': _asDouble(
          priorAudit is Map ? priorAudit['revpar'] : null,
        ),
        'priorNetRevenue': _asDouble(
          priorSnapshot is Map ? priorSnapshot['netRevenue'] : null,
        ),
        'payments': (data['analytics']?['payments'] ?? 0).toDouble(),
        'inHouseGuests': data['analytics']?['inHouseGuests'] ?? 0,
        'latePostings': data['analytics']?['latePostings'] ?? 0,
        'rooms': data['analytics']?['rooms'] ?? {},
      },
      'operations': {
        'arrivals': _listLength(operational['arrivals']),
        'departures': _listLength(operational['departures']),
        'roomReconciliation': _listLength(operational['roomReconciliation']),
        'inHouseGuests': data['analytics']?['inHouseGuests'] ?? 0,
      },
      'controls': {
        'openPosOrders': _listLength(system['openPosOrders']),
        'openPosSessions': _listLength(system['openPosSessions']),
        'openFrontdeskSessions': _listLength(system['openFrontdeskSessions']),
        'financialSyncConflicts': _listLength(system['financialSyncConflicts']),
        'unverifiedComplimentary': _listLength(
          financial['unverifiedComplimentary'],
        ),
        'pendingCheckInBypasses': _listLength(
          financial['pendingCheckInBypasses'],
        ),
        'unverifiedTransactions': _listLength(cash['unverifiedTransactions']),
        'fnbOpenOrders': _listLength(fnbExceptions['openOrders']),
      },
    };
  }

  int _listLength(dynamic value) => value is List ? value.length : 0;

  double _asDouble(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  double _calculateProgress(String state) {
    switch (state) {
      case 'COMPLETED':
        return 100.0;
      case 'POSTING':
        return 75.0;
      case 'IN_PROGRESS':
        return 30.0;
      default:
        return 0.0;
    }
  }
}

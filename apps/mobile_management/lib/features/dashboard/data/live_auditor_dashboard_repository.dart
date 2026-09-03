import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../presentation/models/auditor_dashboard_data.dart';

class LiveAuditorDashboardRepository {
  final Dio _dio;
  final FlutterSecureStorage _storage;
  static const _cacheKey = 'auditor_dashboard_cache';

  LiveAuditorDashboardRepository({required Dio dio, required FlutterSecureStorage storage})
      : _dio = dio, _storage = storage;

  Future<AuditorDashboardData> fetchDashboardData(String propertyId) async {
    try {
      final response = await _dio.get('/api/v1/night-audit/status', queryParameters: {
        'propertyId': propertyId,
      });

      if (response.statusCode == 200) {
        dynamic responseData = response.data;
        if (responseData is String) {
          try {
            responseData = jsonDecode(responseData);
          } catch (_) {}
        }
        
        final Map<String, dynamic> rawData = (responseData is Map && responseData.containsKey('data')) 
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
        'blockingErrors': summary['blockers'] ?? [],
      },
      'auditExceptions': {
        'criticalCount': summary['blockers'] ?? 0,
        'warningCount': summary['warnings'] ?? 0,
      },
      'criticalDiscrepancies': {
        'roomStatusDiscrepancies': (operational['roomReconciliation'] as List?)?.length ?? 0,
        'occupancyDiscrepancies': data['analytics']?['occupancyDiscrepancies'] ?? 0,
        'unpostedCharges': data['analytics']?['latePostings'] ?? 0,
        'openFolios': (financial['highBalances'] as List?)?.length ?? 0, // Approximation
        'reservationsRequiringAttention': (operational['arrivals'] as List?)?.length ?? 0 + ((operational['departures'] as List?)?.length ?? 0),
      },
      'cashReconciliation': {
        'openShifts': (system['openFrontdeskSessions'] as List?)?.length ?? 0,
        'pendingHandovers': (cash['cashHandovers'] as List?)?.length ?? 0,
        'unreconciledCash': (data['analytics']?['cashVariance'] ?? 0).toDouble(),
        'posSessionsRequiringClosure': (system['openPosSessions'] as List?)?.length ?? 0,
        'outstandingDeposits': (cash['bankDeposits'] as List?)?.length ?? 0,
      },
    };
  }
  
  double _calculateProgress(String state) {
    switch (state) {
      case 'COMPLETED': return 100.0;
      case 'POSTING': return 75.0;
      case 'IN_PROGRESS': return 30.0;
      default: return 0.0;
    }
  }
}

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class CashierShift {
  final String id, type, label, operator, status, controlStatus;
  final DateTime? businessDate, openedAt, closedAt, updatedAt;
  final double expected, openingFloat;
  final double? declared, variance;
  final String? approvalNotes;

  const CashierShift({
    required this.id,
    required this.type,
    required this.label,
    required this.operator,
    required this.status,
    required this.controlStatus,
    this.businessDate,
    this.openedAt,
    this.closedAt,
    this.updatedAt,
    required this.expected,
    this.declared,
    this.variance,
    required this.openingFloat,
    this.approvalNotes,
  });

  factory CashierShift.fromJson(Map<String, dynamic> json) => CashierShift(
    id: '${json['id'] ?? ''}',
    type: '${json['type'] ?? 'POS'}',
    label: '${json['label'] ?? 'Cashier shift'}',
    operator: '${json['operator'] ?? 'Unassigned operator'}',
    status: '${json['status'] ?? 'OPEN'}',
    controlStatus: '${json['controlStatus'] ?? 'OPEN'}',
    businessDate: DateTime.tryParse('${json['businessDate'] ?? ''}'),
    openedAt: DateTime.tryParse('${json['openedAt'] ?? ''}'),
    closedAt: DateTime.tryParse('${json['closedAt'] ?? ''}'),
    updatedAt: DateTime.tryParse('${json['updatedAt'] ?? ''}'),
    expected: _number(json['expected']),
    declared: json['declared'] == null ? null : _number(json['declared']),
    variance: json['variance'] == null ? null : _number(json['variance']),
    openingFloat: _number(json['openingFloat']),
    approvalNotes: json['approvalNotes']?.toString(),
  );
  static double _number(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
}

class CashierShiftsRepository {
  final Dio _dio;
  CashierShiftsRepository(this._dio);
  Future<List<CashierShift>> fetch() async {
    final response = await _dio.get('/mobile/v1/cashier/shifts');
    final payload = response.data is Map ? response.data['data'] : null;
    final rows = payload is Map ? payload['shifts'] : null;
    return (rows is List ? rows : const [])
        .map(
          (row) => CashierShift.fromJson(Map<String, dynamic>.from(row as Map)),
        )
        .toList();
  }

  Future<void> act(
    CashierShift shift,
    String action, {
    String? notes,
    String? reasonCode,
  }) async {
    await _dio.post(
      '/mobile/v1/cashier/shifts/${shift.id}',
      data: {
        'type': shift.type,
        'action': action,
        'notes': notes,
        'reasonCode': reasonCode,
      },
    );
  }
}

final cashierShiftsRepositoryProvider = Provider(
  (ref) => CashierShiftsRepository(ref.watch(dioProvider)),
);
final cashierShiftsProvider = FutureProvider<List<CashierShift>>(
  (ref) => ref.watch(cashierShiftsRepositoryProvider).fetch(),
);

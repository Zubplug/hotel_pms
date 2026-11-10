import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class PendingCashHandover {
  final String id, reference, handedOverBy;
  final double amount;
  final DateTime? handedOverAt;
  final List<String> sessions;
  final Map<String, dynamic> paymentBreakdown;

  const PendingCashHandover({
    required this.id,
    required this.reference,
    required this.handedOverBy,
    required this.amount,
    required this.handedOverAt,
    required this.sessions,
    required this.paymentBreakdown,
  });

  factory PendingCashHandover.fromJson(Map<String, dynamic> json) =>
      PendingCashHandover(
        id: '${json['id'] ?? ''}',
        reference: '${json['reference'] ?? 'Cash handover'}',
        handedOverBy: '${json['handedOverBy'] ?? 'Operator'}',
        amount: (json['amount'] is num)
            ? (json['amount'] as num).toDouble()
            : double.tryParse('${json['amount']}') ?? 0,
        handedOverAt: DateTime.tryParse('${json['handedOverAt'] ?? ''}'),
        sessions: (json['sessions'] as List? ?? [])
            .map((item) => '$item')
            .toList(),
        paymentBreakdown: json['paymentBreakdown'] is Map
            ? Map<String, dynamic>.from(json['paymentBreakdown'] as Map)
            : const {},
      );
}

class CashCustodyRepository {
  final Dio _dio;
  CashCustodyRepository(this._dio);

  Future<List<PendingCashHandover>> pendingHandovers() async {
    final response = await _dio.get('/mobile/v1/cashier/custody/handovers');
    final data = response.data is Map ? response.data['data'] : null;
    final rows = data is Map ? data['handovers'] : null;
    return (rows is List ? rows : const [])
        .map(
          (row) => PendingCashHandover.fromJson(
            Map<String, dynamic>.from(row as Map),
          ),
        )
        .toList();
  }

  Future<void> receiveHandover(String id, {String? notes}) async {
    await _dio.post(
      '/mobile/v1/cashier/custody/handovers/$id/receive',
      data: {'notes': notes},
    );
  }
}

final cashCustodyRepositoryProvider = Provider(
  (ref) => CashCustodyRepository(ref.watch(dioProvider)),
);
final pendingCashHandoversProvider = FutureProvider<List<PendingCashHandover>>(
  (ref) => ref.watch(cashCustodyRepositoryProvider).pendingHandovers(),
);

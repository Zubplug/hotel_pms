import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../data/live_finance_repository.dart';
import '../models/finance_data.dart';

final liveFinanceRepositoryProvider = Provider<LiveFinanceRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return LiveFinanceRepository(
    dio: dio,
  );
});

final financePeriodProvider = StateProvider<String>((ref) => 'TODAY');

final financeDataProvider = FutureProvider<FinanceDashboardData>((ref) async {
  final repository = ref.watch(liveFinanceRepositoryProvider);
  final period = ref.watch(financePeriodProvider);
  return await repository.fetchFinanceData(period: period);
});

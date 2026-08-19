import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/storage/secure_storage_provider.dart';
import '../../data/live_executive_dashboard_repository.dart';
import '../models/executive_dashboard_data.dart';

final liveDashboardRepositoryProvider = Provider<LiveExecutiveDashboardRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final storage = ref.watch(secureStorageProvider);
  return LiveExecutiveDashboardRepository(
    dio: dio,
    storage: storage,
  );
});

final dashboardDataProvider = FutureProvider<ExecutiveDashboardData>((ref) async {
  final repository = ref.watch(liveDashboardRepositoryProvider);
  return await repository.fetchDashboardData();
});

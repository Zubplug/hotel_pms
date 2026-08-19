import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/dashboard_repository.dart';

final dashboardDataProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final repository = ref.watch(dashboardRepositoryProvider);
  return await repository.fetchDashboardData();
});

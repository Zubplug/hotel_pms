import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../data/fnb_repository.dart';
import '../models/fnb_dashboard_data.dart';

final fnbRepositoryProvider = Provider<FnbRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return FnbRepository(dio: dio);
});

final fnbDashboardProvider = FutureProvider<FnbDashboardData>((ref) async {
  final repository = ref.watch(fnbRepositoryProvider);
  return repository.fetchFnbDashboard();
});

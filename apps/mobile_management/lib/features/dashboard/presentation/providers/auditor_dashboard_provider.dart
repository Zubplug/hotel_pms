import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/storage/secure_storage_provider.dart';
import '../../data/live_auditor_dashboard_repository.dart';
import '../models/auditor_dashboard_data.dart';
import '../../../hub/providers/hub_provider.dart';

final liveAuditorDashboardRepositoryProvider = Provider<LiveAuditorDashboardRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final storage = ref.watch(secureStorageProvider);
  return LiveAuditorDashboardRepository(
    dio: dio,
    storage: storage,
  );
});

final auditorDashboardDataProvider = FutureProvider<AuditorDashboardData>((ref) async {
  final repository = ref.watch(liveAuditorDashboardRepositoryProvider);
  final propertyId = ref.watch(selectedHubPropertyProvider);
  
  // If propertyId is AUTO_SELECT_FIRST, you might need to handle it or assume it's resolved by the API or other means,
  // but we'll pass it as is.
  return await repository.fetchDashboardData(propertyId);
});

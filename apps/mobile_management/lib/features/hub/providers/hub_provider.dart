import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../data/hub_model.dart';
import '../data/hub_repository.dart';

final hubRepositoryProvider = Provider<HubRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return HubRepository(dio);
});

final selectedHubPropertyProvider = StateProvider<String>((ref) => 'AUTO_SELECT_FIRST');

final hubDataProvider = FutureProvider<HubData>((ref) async {
  final repository = ref.watch(hubRepositoryProvider);
  final propertyId = ref.watch(selectedHubPropertyProvider);
  return await repository.fetchHubData(propertyId: propertyId);
});

final approvalActionProvider = Provider((ref) => ApprovalActionService(ref));

class ApprovalActionService {
  final Ref _ref;

  ApprovalActionService(this._ref);

  Future<void> approve(String approvalId) async {
    final repository = _ref.read(hubRepositoryProvider);
    await repository.approveRequest(approvalId);
    _ref.invalidate(hubDataProvider);
  }

  Future<void> reject(String approvalId, String comments) async {
    final repository = _ref.read(hubRepositoryProvider);
    await repository.rejectRequest(approvalId, comments);
    _ref.invalidate(hubDataProvider);
  }
}

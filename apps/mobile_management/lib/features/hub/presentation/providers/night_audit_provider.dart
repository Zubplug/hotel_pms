import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/night_audit_repository.dart';

final nightAuditPreviewProvider = FutureProvider.family<NightAuditPreview, String>((ref, propertyId) async {
  final repository = ref.watch(nightAuditRepositoryProvider);
  return repository.getPreview(propertyId);
});

class NightAuditExecutionNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  NightAuditExecutionNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<void> execute(String propertyId) async {
    state = const AsyncValue.loading();
    try {
      final repository = _ref.read(nightAuditRepositoryProvider);
      await repository.executeNightAudit(propertyId);
      state = const AsyncValue.data(null);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
}

final nightAuditExecutionProvider = StateNotifierProvider<NightAuditExecutionNotifier, AsyncValue<void>>((ref) {
  return NightAuditExecutionNotifier(ref);
});

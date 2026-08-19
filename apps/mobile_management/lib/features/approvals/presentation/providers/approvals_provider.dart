import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/approvals_repository.dart';

final pendingApprovalsProvider = FutureProvider<List<dynamic>>((ref) async {
  final repository = ref.watch(approvalsRepositoryProvider);
  return await repository.fetchPendingApprovals();
});

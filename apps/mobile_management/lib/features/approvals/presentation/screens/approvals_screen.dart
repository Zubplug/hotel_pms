import 'dart:async';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/approvals_provider.dart';
import '../../data/repositories/approvals_repository.dart';
import '../../../../core/services/websocket_service.dart';

class ApprovalsScreen extends ConsumerStatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  ConsumerState<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends ConsumerState<ApprovalsScreen> {
  final LocalAuthentication _localAuth = LocalAuthentication();
  bool _isAuthenticating = false;
  StreamSubscription? _wsSub;

  @override
  void initState() {
    super.initState();
    // Listen for real-time approval events and auto-refresh
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final wsService = ref.read(webSocketServiceProvider);
      _wsSub = wsService.events.listen((event) {
        if (event.type == WsEventType.approvalCreated ||
            event.type == WsEventType.approvalUpdated) {
          // ignore: unused_result
          ref.invalidate(pendingApprovalsProvider);
        }
      });
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    super.dispose();
  }

  Future<void> _handleApprove(String id, String type, double amount) async {
    setState(() => _isAuthenticating = true);
    try {
      final didAuthenticate = await _localAuth.authenticate(
        localizedReason: 'Authenticate to approve this $type request',
        biometricOnly: false,
        persistAcrossBackgrounding: true,
      );

      if (didAuthenticate) {
        final repo = ref.read(approvalsRepositoryProvider);
        await repo.approveRequest(id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Request approved successfully.'),
              backgroundColor: Colors.green,
            ),
          );
          // ignore: unused_result
          ref.invalidate(pendingApprovalsProvider);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isAuthenticating = false);
    }
  }

  Future<void> _handleReject(String id, String type) async {
    final reasonController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Rejecting $type request. Please provide a reason:'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                hintText: 'Reason for rejection',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Reject'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isAuthenticating = true);
    try {
      final didAuthenticate = await _localAuth.authenticate(
        localizedReason: 'Authenticate to reject this $type request',
        biometricOnly: false,
        persistAcrossBackgrounding: true,
      );

      if (didAuthenticate) {
        final repo = ref.read(approvalsRepositoryProvider);
        await repo.rejectRequest(id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Request rejected.'),
              backgroundColor: Colors.orange,
            ),
          );
          // ignore: unused_result
          ref.invalidate(pendingApprovalsProvider);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isAuthenticating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final approvalsAsync = ref.watch(pendingApprovalsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Pending Approvals', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () { ref.invalidate(pendingApprovalsProvider); },
          ),
        ],
      ),
      body: _isAuthenticating
          ? const Center(child: CircularProgressIndicator())
          : approvalsAsync.when(
              data: (approvals) {
                if (approvals.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle_outline, size: 64, color: Colors.green),
                        SizedBox(height: 16),
                        Text('All clear — no pending approvals', style: TextStyle(fontSize: 16, color: Colors.grey)),
                      ],
                    ),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: approvals.length,
                  itemBuilder: (context, index) {
                    final req = approvals[index] as Map<String, dynamic>;
                    final amount = req['amount'] != null ? (req['amount'] as num).toDouble() : 0.0;
                    return _buildApprovalCard(
                      id: req['id'] as String,
                      type: req['type'] as String,
                      amount: amount,
                      currency: req['currency'] as String? ?? 'NGN',
                      requester: req['requestedBy'] as String? ?? 'Unknown',
                      reason: req['reason'] as String? ?? 'No reason provided',
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 48),
                    const SizedBox(height: 16),
                    Text('Failed to load: $err'),
                    TextButton(
                      onPressed: () { ref.invalidate(pendingApprovalsProvider); },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildApprovalCard({
    required String id,
    required String type,
    required double amount,
    required String currency,
    required String requester,
    required String reason,
  }) {
    final symbol = currency == 'NGN' ? '₦' : currency;
    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: Text(
                    type,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.orange.shade800,
                      fontSize: 12,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                Text(
                  id.length > 12 ? '...${id.substring(id.length - 8)}' : id,
                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              '$symbol${amount.toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFF1E3A8A)),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.person_outline, size: 16, color: Colors.grey),
                const SizedBox(width: 6),
                Expanded(child: Text(requester, style: const TextStyle(fontWeight: FontWeight.w500))),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                reason,
                style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _handleReject(id, type),
                    icon: const Icon(Icons.close, size: 16),
                    label: const Text('REJECT'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _handleApprove(id, type, amount),
                    icon: const Icon(Icons.check, size: 16),
                    label: const Text('APPROVE'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

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
        await repo.approveRequest(id, source: _sourceFor(type));
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
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
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
        await repo.rejectRequest(
          id,
          reasonController.text.trim(),
          source: _sourceFor(type),
        );
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

  String _sourceFor(String type) {
    switch (type.toUpperCase()) {
      case 'STOCK_TRANSFER':
        return 'STOCK_TRANSFER';
      case 'PURCHASE_ORDER':
        return 'PURCHASE_ORDER';
      case 'EXPENSE':
        return 'EXPENSE';
      case 'EMPLOYEE_REIMBURSEMENT':
        return 'EMPLOYEE_REIMBURSEMENT';
      case 'EMPLOYEE_BENEFIT':
        return 'EMPLOYEE_BENEFIT';
      case 'EVENT_INVOICE':
        return 'EVENT_INVOICE';
      default:
        return 'APPROVAL_REQUEST';
    }
  }

  @override
  Widget build(BuildContext context) {
    final approvalsAsync = ref.watch(pendingApprovalsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF070D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF070D1A),
        foregroundColor: const Color(0xFFF1F5FF),
        title: const Text(
          'Decision Queue',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(pendingApprovalsProvider);
            },
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
                        Icon(
                          Icons.check_circle_outline,
                          size: 64,
                          color: Colors.green,
                        ),
                        SizedBox(height: 16),
                        Text(
                          'All clear — no pending approvals',
                          style: TextStyle(fontSize: 16, color: Colors.grey),
                        ),
                      ],
                    ),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: approvals.length,
                  itemBuilder: (context, index) {
                    final req = approvals[index] as Map<String, dynamic>;
                    final amount = req['amount'] != null
                        ? (req['amount'] as num).toDouble()
                        : 0.0;
                    return _buildApprovalCard(
                      request: req,
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
                    const Icon(
                      Icons.error_outline,
                      color: Colors.red,
                      size: 48,
                    ),
                    const SizedBox(height: 16),
                    Text('Failed to load: $err'),
                    TextButton(
                      onPressed: () {
                        ref.invalidate(pendingApprovalsProvider);
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildApprovalCard({
    required Map<String, dynamic> request,
    required String id,
    required String type,
    required double amount,
    required String currency,
    required String requester,
    required String reason,
  }) {
    final symbol = currency == 'NGN' ? '₦' : currency;
    return Card(
      color: const Color(0xFF101B30),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showApprovalDetails(request, amount, currency, type),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.orange.shade200),
                    ),
                    child: Text(
                      type,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFF3A557),
                        fontSize: 12,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  Text(
                    id.length > 12 ? '...${id.substring(id.length - 8)}' : id,
                    style: const TextStyle(
                      color: Color(0xFF91A2BF),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                '$symbol${amount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFFF1F5FF),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(
                    Icons.person_outline,
                    size: 16,
                    color: Color(0xFF91A2BF),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      requester,
                      style: const TextStyle(
                        color: Color(0xFFD7E1F2),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF16243D),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  reason,
                  style: const TextStyle(
                    color: Color(0xFFB8C5D9),
                    fontSize: 13,
                  ),
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
                        foregroundColor: const Color(0xFFF07478),
                        side: const BorderSide(color: Color(0xFFF07478)),
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
                        backgroundColor: const Color(0xFF42D392),
                        foregroundColor: const Color(0xFF070D1A),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showApprovalDetails(
    Map<String, dynamic> request,
    double amount,
    String currency,
    String type,
  ) {
    final details = request['details'];
    final snapshot = request['snapshot'];
    final reason = request['reason'] as String? ?? 'No reason provided';
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF101B30),
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _requestTitle(type),
                        style: TextStyle(
                          color: Color(0xFFF1F5FF),
                          fontSize: 21,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    _detailBadge(type),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${currency == 'NGN' ? '₦' : currency}${amount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Color(0xFFD8AD52),
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 18),
                _detailLine('Request ID', request['id']?.toString() ?? '—'),
                _detailLine(
                  'Requested by',
                  request['requestedBy']?.toString() ?? '—',
                ),
                _detailLine(
                  'Submitted',
                  request['requestedAt']?.toString() ??
                      request['createdAt']?.toString() ??
                      '—',
                ),
                const SizedBox(height: 14),
                const Text(
                  'Reason',
                  style: TextStyle(
                    color: Color(0xFF91A2BF),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: .8,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  reason,
                  style: const TextStyle(
                    color: Color(0xFFD7E1F2),
                    fontSize: 14,
                    height: 1.45,
                  ),
                ),
                ..._buildRequestDetails(type, details, snapshot),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.pop(sheetContext);
                          _handleReject(request['id'].toString(), type);
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFF07478),
                          side: const BorderSide(color: Color(0xFFF07478)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Reject'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          Navigator.pop(sheetContext);
                          _handleApprove(
                            request['id'].toString(),
                            type,
                            amount,
                          );
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF42D392),
                          foregroundColor: const Color(0xFF070D1A),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Approve'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _detailBadge(String type) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
    decoration: BoxDecoration(
      color: const Color(0xFFF3A557).withValues(alpha: .12),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      type.replaceAll('_', ' '),
      style: const TextStyle(
        color: Color(0xFFF3A557),
        fontSize: 10,
        fontWeight: FontWeight.w800,
      ),
    ),
  );

  String _requestTitle(String type) {
    switch (type.toUpperCase()) {
      case 'REFUND':
        return 'Refund review';
      case 'DISCOUNT':
        return 'Discount review';
      case 'COMPLIMENTARY':
        return 'Complimentary review';
      case 'VOID':
        return 'Void transaction review';
      case 'POS_PRICE_CHANGE':
      case 'POS_MENU_CREATE':
      case 'POS_MODIFIER_CREATE':
      case 'POS_MODIFIER_UPDATE':
        return 'F&B pricing review';
      case 'CORPORATE_CREDIT':
        return 'Corporate credit review';
      case 'INVENTORY_ADJUSTMENT':
        return 'Inventory adjustment review';
      default:
        return 'Management review';
    }
  }

  List<Widget> _buildRequestDetails(
    String type,
    dynamic details,
    dynamic snapshot,
  ) {
    final detailMap = details is Map
        ? Map<String, dynamic>.from(details)
        : <String, dynamic>{};
    final snapshotMap = snapshot is Map
        ? Map<String, dynamic>.from(snapshot)
        : <String, dynamic>{};
    final keysByType = <String, List<String>>{
      'REFUND': [
        'refundRequestId',
        'reservationId',
        'guestName',
        'roomNumber',
        'stage',
        'refundMethod',
      ],
      'DISCOUNT': [
        'reservationRoomId',
        'reservationId',
        'guestName',
        'roomNumber',
        'discountType',
        'discountAmount',
        'discountPercent',
        'stage',
      ],
      'COMPLIMENTARY': [
        'reservationRoomId',
        'reservationId',
        'guestName',
        'roomNumber',
        'reason',
        'stage',
      ],
      'VOID': [
        'transactionId',
        'reservationId',
        'guestName',
        'roomNumber',
        'stage',
      ],
      'POS_PRICE_CHANGE': [
        'productName',
        'productId',
        'oldPrice',
        'newPrice',
        'stage',
      ],
      'POS_MENU_CREATE': [
        'name',
        'price',
        'taxRate',
        'inventoryMode',
        'productionStation',
        'stage',
      ],
      'POS_MODIFIER_CREATE': [
        'name',
        'groupName',
        'price',
        'productName',
        'stage',
      ],
      'POS_MODIFIER_UPDATE': [
        'name',
        'groupName',
        'price',
        'productName',
        'stage',
      ],
      'CORPORATE_CREDIT': [
        'reservationId',
        'eventId',
        'corporateAccountId',
        'creditLimit',
        'stage',
      ],
      'INVENTORY_ADJUSTMENT': [
        'stockItemId',
        'itemName',
        'quantity',
        'unit',
        'stage',
      ],
    };
    final requestedKeys =
        keysByType[type.toUpperCase()] ?? detailMap.keys.toList();
    final rows = <Widget>[];
    for (final key in requestedKeys) {
      final value = detailMap[key] ?? snapshotMap[key];
      if (value == null || value.toString().trim().isEmpty) continue;
      rows.add(_detailLine(_humanizeKey(key), _displayValue(value)));
    }
    if (rows.isEmpty && snapshotMap.isNotEmpty) {
      for (final entry in snapshotMap.entries.take(8)) {
        if (entry.value == null) continue;
        rows.add(
          _detailLine(_humanizeKey(entry.key), _displayValue(entry.value)),
        );
      }
    }
    if (rows.isEmpty) return const [];
    return [
      const SizedBox(height: 16),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
        decoration: BoxDecoration(
          color: const Color(0xFF16243D),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF243653)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _requestSectionTitle(type),
              style: const TextStyle(
                color: Color(0xFF91A2BF),
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: .8,
              ),
            ),
            const SizedBox(height: 10),
            ...rows,
          ],
        ),
      ),
    ];
  }

  String _requestSectionTitle(String type) {
    switch (type.toUpperCase()) {
      case 'REFUND':
        return 'REFUND CONTEXT';
      case 'DISCOUNT':
      case 'COMPLIMENTARY':
        return 'GUEST ENTITLEMENT';
      case 'POS_PRICE_CHANGE':
      case 'POS_MENU_CREATE':
      case 'POS_MODIFIER_CREATE':
      case 'POS_MODIFIER_UPDATE':
        return 'F&B CHANGE REQUEST';
      default:
        return 'REQUEST CONTEXT';
    }
  }

  String _humanizeKey(String key) => key
      .replaceAllMapped(
        RegExp(r'([a-z])([A-Z])'),
        (match) => '${match.group(1)} ${match.group(2)}',
      )
      .replaceAll('_', ' ')
      .split(' ')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');

  String _displayValue(dynamic value) {
    if (value is bool) return value ? 'Yes' : 'No';
    if (value is List) return value.join(', ');
    if (value is Map) return 'Additional information';
    return value.toString();
  }

  Widget _detailLine(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 105,
          child: Text(
            label,
            style: const TextStyle(color: Color(0xFF91A2BF), fontSize: 12),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: Color(0xFFD7E1F2),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

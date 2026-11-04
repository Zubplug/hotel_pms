import 'dart:async';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/approvals_provider.dart';
import '../../data/repositories/approvals_repository.dart';
import '../../../../core/services/websocket_service.dart';
import '../../../../core/utils/room_number_formatter.dart';

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
                  return _emptyState();
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                  itemCount: approvals.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) return _queueHeader(approvals.length);
                    final approvalIndex = index - 1;
                    final raw = approvals[approvalIndex];
                    final req = raw is Map
                        ? Map<String, dynamic>.from(raw)
                        : <String, dynamic>{};
                    final id =
                        req['id']?.toString() ?? 'request-$approvalIndex';
                    final type = req['type']?.toString() ?? 'APPROVAL_REQUEST';
                    final rawAmount = req['amount'];
                    final amount = rawAmount is num
                        ? rawAmount.toDouble()
                        : double.tryParse(rawAmount?.toString() ?? '') ?? 0.0;
                    return _buildApprovalCard(
                      request: req,
                      id: id,
                      type: type,
                      amount: amount,
                      currency: req['currency']?.toString() ?? 'NGN',
                      requester: _requesterLabel(req),
                      reason: req['reason']?.toString() ?? 'No reason provided',
                    );
                  },
                );
              },
              loading: () => const Center(
                child: CircularProgressIndicator(color: Color(0xFFD8AD52)),
              ),
              error: (err, _) => _errorState(err),
            ),
    );
  }

  Widget _emptyState() => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 82,
            height: 82,
            decoration: BoxDecoration(
              color: const Color(0xFF42D392).withValues(alpha: .12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.verified_rounded,
              size: 42,
              color: Color(0xFF42D392),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'All clear',
            style: TextStyle(
              color: Color(0xFFF1F5FF),
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'There are no pending approval decisions for this property.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF91A2BF), height: 1.45),
          ),
        ],
      ),
    ),
  );

  Widget _errorState(Object error) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            color: Colors.redAccent,
            size: 48,
          ),
          const SizedBox(height: 14),
          const Text(
            'Could not load approvals',
            style: TextStyle(
              color: Color(0xFFF1F5FF),
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            error.toString(),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF91A2BF), height: 1.4),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => ref.invalidate(pendingApprovalsProvider),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try again'),
          ),
        ],
      ),
    ),
  );

  Widget _queueHeader(int count) => Container(
    margin: const EdgeInsets.only(bottom: 18),
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF1D3154), Color(0xFF101B30)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: const Color(0xFFD8AD52).withValues(alpha: .24)),
    ),
    child: Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: const Color(0xFFD8AD52).withValues(alpha: .14),
            borderRadius: BorderRadius.circular(15),
          ),
          child: const Icon(Icons.fact_check_rounded, color: Color(0xFFD8AD52)),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Management decisions',
                style: TextStyle(
                  color: Color(0xFFF1F5FF),
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$count pending request${count == 1 ? '' : 's'} require review',
                style: const TextStyle(color: Color(0xFF91A2BF), fontSize: 12),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: const Color(0xFFF3A557).withValues(alpha: .14),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            '$count OPEN',
            style: const TextStyle(
              color: Color(0xFFF3A557),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: .7,
            ),
          ),
        ),
      ],
    ),
  );

  Map<String, dynamic> _requestContext(Map<String, dynamic> request) {
    final context = <String, dynamic>{};
    void merge(dynamic value) {
      if (value is! Map) return;
      for (final entry in Map<String, dynamic>.from(value).entries) {
        if (entry.value != null && entry.value.toString().trim().isNotEmpty) {
          context[entry.key] = entry.value;
        }
      }
    }

    merge(request['snapshot']);
    merge(request['details']);
    merge(request['metadata']);
    merge(request['context']);
    merge(request['payload']);
    merge(request['request']);
    merge(request);

    // The API enriches room-based approvals under `details.review`.
    final review = request['details'] is Map
        ? (request['details'] as Map)['review']
        : null;
    if (review is Map) {
      final reservation = review['reservation'];
      final room = review['room'];
      final guest = reservation is Map ? reservation['primaryGuest'] : null;
      final roomType = room is Map ? room['roomType'] : null;
      if (guest is Map) {
        final name = '${guest['firstName'] ?? ''} ${guest['lastName'] ?? ''}'
            .trim();
        if (name.isNotEmpty) context['guestName'] = name;
      }
      if (room is Map && room['number'] != null) {
        context['roomNumber'] = room['number'];
      }
      if (roomType is Map && roomType['name'] != null) {
        context['roomType'] = roomType['name'];
      }
      if (reservation is Map) {
        for (final key in ['confirmationNumber', 'checkIn', 'checkOut']) {
          if (reservation[key] != null) context[key] = reservation[key];
        }
      }
    }
    return context;
  }

  String _requesterLabel(Map<String, dynamic> request) {
    final context = _requestContext(request);
    final value =
        context['requestedByName'] ??
        context['requesterName'] ??
        context['requestedByUserName'] ??
        context['requester'] ??
        context['requestedBy'];
    final text = value?.toString().trim() ?? '';
    return text.isEmpty || _looksLikeId(text) ? 'Management request' : text;
  }

  String? _guestLabel(Map<String, dynamic> request) {
    final context = _requestContext(request);
    final value =
        context['guestName'] ??
        context['guestFullName'] ??
        context['primaryGuestName'] ??
        context['guest'];
    final text = value?.toString().trim() ?? '';
    return text.isEmpty || _looksLikeId(text) ? null : text;
  }

  String? _roomLabel(Map<String, dynamic> request) {
    final context = _requestContext(request);
    final value = context['roomNumber'] ?? context['roomNo'] ?? context['room'];
    final text = value?.toString().trim() ?? '';
    return text.isEmpty || _looksLikeId(text)
        ? null
        : formatRoomNumber(text, fallback: text);
  }

  bool _looksLikeId(String value) => RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  ).hasMatch(value);

  String _submittedLabel(Map<String, dynamic> request) {
    final value = request['requestedAt'] ?? request['createdAt'];
    final date = value == null ? null : DateTime.tryParse(value.toString());
    if (date == null) return 'Submitted recently';
    return DateFormat('d MMM yyyy · h:mm a').format(date.toLocal());
  }

  String _formatAmount(num value, String currency) {
    final code = currency.trim().isEmpty
        ? 'NGN'
        : currency.trim().toUpperCase();
    final symbol = code == 'NGN' ? '₦' : '$code ';
    return NumberFormat.currency(
      locale: 'en_NG',
      symbol: symbol,
      decimalDigits: 2,
    ).format(value);
  }

  String? _cardContextSummary(String type, Map<String, dynamic> request) {
    final context = _requestContext(request);
    final upper = type.toUpperCase();
    if (upper == 'DISCOUNT') {
      final percent = context['discountPercent'] ?? context['percentage'];
      final discount = context['discountAmount'] ?? context['discountValue'];
      if (percent != null && num.tryParse(percent.toString()) != null) {
        return 'Requested concession · ${num.parse(percent.toString()).toStringAsFixed(0)}%';
      }
      if (discount != null && num.tryParse(discount.toString()) != null) {
        return 'Requested concession · ${_formatAmount(num.parse(discount.toString()), 'NGN')}';
      }
    }
    if (upper == 'COMPLIMENTARY') {
      final item =
          context['itemName'] ??
          context['amenityName'] ??
          context['productName'] ??
          context['serviceName'];
      if (item != null && item.toString().trim().isNotEmpty) {
        return 'Complimentary benefit · ${item.toString()}';
      }
    }
    return null;
  }

  String _displayType(String type) {
    switch (type.toUpperCase()) {
      case 'DISCOUNT':
        return 'Discount approval';
      case 'COMPLIMENTARY':
        return 'Complimentary approval';
      case 'REFUND':
        return 'Refund approval';
      case 'VOID':
        return 'Void transaction approval';
      case 'STOCK_TRANSFER':
        return 'Stock transfer approval';
      case 'PURCHASE_ORDER':
        return 'Purchase order approval';
      default:
        return type
            .replaceAll('_', ' ')
            .toLowerCase()
            .split(' ')
            .map((word) {
              return word.isEmpty
                  ? word
                  : '${word[0].toUpperCase()}${word.substring(1)}';
            })
            .join(' ');
    }
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
    return Card(
      color: const Color(0xFF101B30),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Colors.white.withValues(alpha: .07)),
      ),
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
                      color: const Color(0xFFF3A557).withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: const Color(0xFFF3A557).withValues(alpha: .3),
                      ),
                    ),
                    child: Text(
                      _displayType(type),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFF3A557),
                        fontSize: 12,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  Text(
                    _submittedLabel(request),
                    style: const TextStyle(
                      color: Color(0xFF91A2BF),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_cardContextSummary(type, request) != null) ...[
                Text(
                  _cardContextSummary(type, request)!,
                  style: const TextStyle(
                    color: Color(0xFFD8AD52),
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 9),
              ],
              const Text(
                'AMOUNT UNDER REVIEW',
                style: TextStyle(
                  color: Color(0xFF91A2BF),
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .8,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                _formatAmount(amount, currency),
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
              Text(
                'Submitted ${_submittedLabel(request)}',
                style: const TextStyle(color: Color(0xFF91A2BF), fontSize: 11),
              ),
              const SizedBox(height: 9),
              if (_guestLabel(request) != null || _roomLabel(request) != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.hotel_outlined,
                        size: 16,
                        color: Color(0xFF91A2BF),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          [
                            if (_guestLabel(request) != null)
                              _guestLabel(request)!,
                            if (_roomLabel(request) != null)
                              'Room ${_roomLabel(request)}',
                          ].join('  •  '),
                          style: const TextStyle(
                            color: Color(0xFFD7E1F2),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
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
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () =>
                      _showApprovalDetails(request, amount, currency, type),
                  icon: const Icon(Icons.open_in_new_rounded, size: 16),
                  label: const Text('View approval details'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFD8AD52),
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
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
    final reason = request['reason']?.toString() ?? 'No reason provided';
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (pageContext) => Scaffold(
          backgroundColor: const Color(0xFF101B30),
          appBar: AppBar(
            backgroundColor: const Color(0xFF101B30),
            foregroundColor: const Color(0xFFF1F5FF),
            elevation: 0,
            title: const Text(
              'Approval review',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
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
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16243D),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF243653)),
                      ),
                      child: const Row(
                        children: [
                          Icon(
                            Icons.shield_outlined,
                            color: Color(0xFF42D392),
                            size: 18,
                          ),
                          SizedBox(width: 9),
                          Expanded(
                            child: Text(
                              'Review the request context before making a decision. Approval actions are authenticated.',
                              style: TextStyle(
                                color: Color(0xFFB8C5D9),
                                fontSize: 11,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _formatAmount(amount, currency),
                      style: const TextStyle(
                        color: Color(0xFFD8AD52),
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 18),
                    _detailLine('Request ID', request['id']?.toString() ?? '—'),
                    _detailLine('Requested by', _requesterLabel(request)),
                    if (_guestLabel(request) != null)
                      _detailLine('Guest', _guestLabel(request)!),
                    if (_roomLabel(request) != null)
                      _detailLine('Room', _roomLabel(request)!),
                    _detailLine('Submitted', _submittedLabel(request)),
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
                    ..._buildRequestDetails(type, request),
                    const SizedBox(height: 20),
                    const SizedBox(height: 92),
                  ],
                ),
              ),
            ),
          ),
          bottomNavigationBar: SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
              decoration: const BoxDecoration(
                color: Color(0xFF0B1426),
                border: Border(top: BorderSide(color: Color(0xFF243653))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(pageContext);
                        _handleReject(request['id'].toString(), type);
                      },
                      icon: const Icon(Icons.close_rounded, size: 17),
                      label: const Text('Reject'),
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
                      onPressed: () {
                        Navigator.pop(pageContext);
                        _handleApprove(request['id'].toString(), type, amount);
                      },
                      icon: const Icon(Icons.check_rounded, size: 17),
                      label: const Text('Approve'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF42D392),
                        foregroundColor: const Color(0xFF070D1A),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
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

  List<Widget> _buildRequestDetails(String type, Map<String, dynamic> request) {
    final detailMap = _requestContext(request);
    final snapshotMap = detailMap;
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
        'guestName',
        'roomNumber',
        'roomType',
        'confirmationNumber',
        'checkIn',
        'checkOut',
        'discountType',
        'discountAmount',
        'discountPercent',
        'originalAmount',
        'originalRate',
        'finalAmount',
        'beneficiaryType',
        'acknowledgingStaffName',
        'stage',
      ],
      'COMPLIMENTARY': [
        'guestName',
        'roomNumber',
        'roomType',
        'confirmationNumber',
        'amenityName',
        'itemName',
        'serviceName',
        'quantity',
        'estimatedCost',
        'beneficiaryType',
        'settlementType',
        'acknowledgingStaffName',
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
      final value =
          detailMap[key] ??
          snapshotMap[key] ??
          _decisionAliasValue(type, key, detailMap, snapshotMap);
      if (value == null || value.toString().trim().isEmpty) continue;
      rows.add(
        _detailLine(_humanizeKey(key), _displayDecisionValue(key, value)),
      );
    }
    if (rows.isEmpty && snapshotMap.isNotEmpty) {
      for (final entry in snapshotMap.entries.take(8)) {
        if (entry.value == null) continue;
        if (entry.key.toLowerCase().endsWith('id') ||
            _looksLikeId(entry.value.toString())) {
          continue;
        }
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
            if (_decisionGuidance(type) != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF0E1A2E),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.lightbulb_outline_rounded,
                      color: Color(0xFFD8AD52),
                      size: 17,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _decisionGuidance(type)!,
                        style: const TextStyle(
                          color: Color(0xFFB8C5D9),
                          fontSize: 11,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
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

  String? _decisionGuidance(String type) {
    switch (type.toUpperCase()) {
      case 'DISCOUNT':
        return 'Confirm the guest, room, discount basis, and final financial impact. Approve only when the request matches the property policy and supporting reason.';
      case 'COMPLIMENTARY':
        return 'Confirm the guest entitlement, room, quantity, and business reason. Check that the benefit is authorised and can be fulfilled operationally.';
      default:
        return null;
    }
  }

  dynamic _decisionAliasValue(
    String type,
    String key,
    Map<String, dynamic> details,
    Map<String, dynamic> snapshot,
  ) {
    final combined = {...snapshot, ...details};
    final aliases = <String, List<String>>{
      'guestName': ['guest', 'guestFullName', 'primaryGuestName'],
      'roomNumber': ['room', 'roomNo', 'roomName'],
      'amenityName': ['amenity', 'amenityType', 'entitlement'],
      'itemName': ['item', 'inventoryItem', 'productName'],
      'serviceName': ['service', 'benefitName'],
      'discountAmount': ['amount', 'discountValue'],
      'discountPercent': ['percentage', 'percent'],
      'estimatedCost': ['cost', 'amount'],
    };
    for (final alias in aliases[key] ?? const <String>[]) {
      if (combined[alias] != null) return combined[alias];
    }
    return null;
  }

  String _displayDecisionValue(String key, dynamic value) {
    if (key.toLowerCase().contains('date') ||
        key.toLowerCase().contains('checkin') ||
        key.toLowerCase().contains('checkout') ||
        key.toLowerCase().endsWith('at')) {
      final parsed = DateTime.tryParse(value.toString());
      if (parsed != null) {
        return DateFormat('d MMM yyyy · h:mm a').format(parsed.toLocal());
      }
    }
    final numeric = num.tryParse(value.toString());
    if (numeric != null &&
        (key.toLowerCase().contains('amount') ||
            key.toLowerCase().contains('cost') ||
            key.toLowerCase().contains('price'))) {
      return _formatAmount(numeric, 'NGN');
    }
    if (numeric != null && key.toLowerCase().contains('percent')) {
      return '${numeric.toStringAsFixed(2)}%';
    }
    return _displayValue(value);
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

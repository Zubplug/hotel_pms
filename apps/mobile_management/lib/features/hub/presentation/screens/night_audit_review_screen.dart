import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../data/night_audit_repository.dart';
import '../../../finance/presentation/screens/finance_screen.dart';
import '../providers/night_audit_provider.dart';
import 'hub_screen.dart';
import '../../../../core/utils/room_number_formatter.dart';

const _bg = Color(0xFF070D1A);
const _card = Color(0xFF111D33);
const _gold = Color(0xFFD4A853);
const _text = Color(0xFFEEF2FF);
const _muted = Color(0xFF94A3B8);

String _displayDate(dynamic input) {
  final parsed = DateTime.tryParse(input?.toString() ?? '');
  if (parsed == null) return input?.toString() ?? '—';
  return DateFormat('dd MMM yyyy').format(parsed.toLocal());
}

String _displayDateTime(dynamic input) {
  final parsed = DateTime.tryParse(input?.toString() ?? '');
  if (parsed == null) return input?.toString() ?? '—';
  return DateFormat('dd MMM yyyy, h:mm a').format(parsed.toLocal());
}

final nightAuditWorkflowProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, propertyId) {
      return ref.watch(nightAuditRepositoryProvider).getWorkflow(propertyId);
    });

class NightAuditReviewScreen extends ConsumerStatefulWidget {
  final String propertyId;
  final String propertyName;

  const NightAuditReviewScreen({
    super.key,
    required this.propertyId,
    required this.propertyName,
  });

  @override
  ConsumerState<NightAuditReviewScreen> createState() =>
      _NightAuditReviewScreenState();
}

class _NightAuditReviewScreenState
    extends ConsumerState<NightAuditReviewScreen> {
  int step = 0;
  bool confirming = false;

  static const stages = <({String title, String subtitle, IconData icon})>[
    (
      title: 'Operations',
      subtitle: 'Arrivals, departures and rooms',
      icon: Icons.hotel_rounded,
    ),
    (
      title: 'System control',
      subtitle: 'POS, shifts and synchronisation',
      icon: Icons.tune_rounded,
    ),
    (
      title: 'Financial review',
      subtitle: 'Folios, approvals and postings',
      icon: Icons.receipt_long_rounded,
    ),
    (
      title: 'Cash control',
      subtitle: 'Transactions and handovers',
      icon: Icons.account_balance_wallet_rounded,
    ),
    (
      title: 'Sign-off',
      subtitle: 'Confirm and close the date',
      icon: Icons.verified_user_rounded,
    ),
  ];

  Map<String, dynamic> map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
  List<dynamic> list(dynamic value) => value is List ? value : const [];
  int count(dynamic value) =>
      value is List ? value.length : (value is num ? value.toInt() : 0);
  String text(dynamic value, [String fallback = '—']) =>
      value == null || value.toString().trim().isEmpty
      ? fallback
      : value.toString();

  @override
  Widget build(BuildContext context) {
    final workflow = ref.watch(nightAuditWorkflowProvider(widget.propertyId));
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        foregroundColor: _text,
        elevation: 0,
        title: const Text(
          'Start Night Audit',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: () =>
                ref.invalidate(nightAuditWorkflowProvider(widget.propertyId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: workflow.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _gold)),
        error: (error, _) => _error(error),
        data: (data) => _wizard(context, data),
      ),
    );
  }

  Widget _error(Object error) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            color: Colors.redAccent,
            size: 48,
          ),
          const SizedBox(height: 14),
          const Text(
            'Unable to load audit controls',
            style: TextStyle(
              color: _text,
              fontSize: 17,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            error.toString(),
            textAlign: TextAlign.center,
            style: const TextStyle(color: _muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () =>
                ref.invalidate(nightAuditWorkflowProvider(widget.propertyId)),
            child: const Text('Try again'),
          ),
        ],
      ),
    ),
  );

  Widget _wizard(BuildContext context, Map<String, dynamic> data) {
    final blockers = _blockers(data);
    final businessDate = text(data['businessDate']);
    return Column(
      children: [
        _header(_displayDate(businessDate)),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
            children: [
              Text(
                stages[step].title,
                style: const TextStyle(
                  color: _text,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                stages[step].subtitle,
                style: const TextStyle(color: _muted),
              ),
              const SizedBox(height: 18),
              if (step < 4) _stageContent(data, blockers),
              if (step == 4) _signOff(data, blockers),
            ],
          ),
        ),
        _bottomBar(data, blockers),
      ],
    );
  }

  Widget _header(String date) => Container(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 18),
    decoration: const BoxDecoration(
      color: _bg,
      border: Border(bottom: BorderSide(color: Color(0xFF1E3355))),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.propertyName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _gold,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Business date $date',
                    style: const TextStyle(color: _muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const Icon(Icons.nightlight_round, color: _gold),
          ],
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: _gold.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(stages[step].icon, color: _gold, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'STEP ${step + 1} OF ${stages.length}',
                    style: const TextStyle(
                      color: _gold,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    stages[step].title,
                    style: const TextStyle(
                      color: _text,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '${((step + 1) / stages.length * 100).round()}%',
              style: const TextStyle(
                color: _muted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: (step + 1) / stages.length,
            minHeight: 5,
            backgroundColor: Colors.white10,
            valueColor: const AlwaysStoppedAnimation<Color>(_gold),
          ),
        ),
      ],
    ),
  );

  List<Map<String, dynamic>> _blockers(Map<String, dynamic> data) {
    final operational = map(data['operational']);
    final system = map(data['system']);
    final financial = map(data['financial']);
    final cash = map(data['cash']);
    final fnb = map(data['fnb']);
    final exceptions = map(fnb['exceptions']);
    final result = <Map<String, dynamic>>[];
    final systemOpenPosOrders = list(system['openPosOrders']);
    final fnbOpenOrders = list(exceptions['openOrders']);
    final systemOrderIds = systemOpenPosOrders
        .map((order) => map(order)['id']?.toString())
        .whereType<String>()
        .toSet();
    final additionalFnbOrders = fnbOpenOrders
        .where(
          (order) => !systemOrderIds.contains(map(order)['id']?.toString()),
        )
        .toList();
    void add(
      String key,
      String title,
      String detail,
      dynamic values,
      String action,
    ) {
      final entries = list(values);
      for (final value in entries) {
        result.add({
          'key': key,
          'title': title,
          'detail': detail,
          'item': map(value),
          'action': action,
        });
      }
    }

    add(
      'pos-order',
      'Open POS order',
      'Investigate and settle or void this order.',
      systemOpenPosOrders,
      'void',
    );
    add(
      'sync',
      'Financial sync conflict',
      'Resolve the conflict in the Sync Centre before closing.',
      system['financialSyncConflicts'],
      'info',
    );
    add(
      'complimentary',
      'Complimentary pending approval',
      'Approve or reject complimentary food, room, or service entitlement.',
      financial['unverifiedComplimentary'],
      'complimentary',
    );
    add(
      'discount',
      'Discount pending approval',
      'Approve or reject the requested discount before room charges are posted.',
      financial['pendingDiscounts'],
      'discount',
    );
    add(
      'bypass',
      'Check-in bypass pending approval',
      'Verify or reject the deposit bypass with an audit note.',
      financial['pendingCheckInBypasses'],
      'bypass',
    );
    add(
      'arrival',
      'Pending arrival',
      'Check in, mark no-show, cancel, or update the reservation before closing.',
      operational['arrivals'],
      'info',
    );
    add(
      'departure',
      'Pending departure',
      'Check out the guest or extend the stay before closing.',
      operational['departures'],
      'info',
    );
    final guestAmenity = map(financial['guestAmenity']);
    final amenityBlockers = list(guestAmenity['blockers']);
    if (amenityBlockers.isNotEmpty) {
      result.add({
        'key': 'guest-amenity',
        'title': 'Guest complimentary inventory blockage',
        'detail':
            'Warehouse or mapped stock is unavailable for this audit date.',
        'item': {
          'enabled': guestAmenity['enabled'],
          'warehouse': map(guestAmenity['warehouse']),
          'guestCount': guestAmenity['guestCount'],
          'estimatedCost': guestAmenity['estimatedCost'],
          'items': list(guestAmenity['items']),
          'blockers': amenityBlockers,
        },
        'action': 'info',
      });
    }
    add(
      'transaction',
      'Unverified transaction',
      'Verify the receipt or question it with a reason.',
      cash['unverifiedTransactions'],
      'transaction',
    );
    add(
      'fnb-order',
      'Open F&B order',
      'The responsible waiter must settle or void this order.',
      additionalFnbOrders,
      'info',
    );
    add(
      'pos-session',
      'Open POS session',
      'The cashier must close and reconcile the session.',
      system['openPosSessions'],
      'info',
    );
    add(
      'frontdesk',
      'Open front-desk shift',
      'The front-desk cashier must close the shift.',
      system['openFrontdeskSessions'],
      'info',
    );
    return result;
  }

  Widget _stageContent(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> blockers,
  ) {
    if (step == 0) return _operations(data);
    if (step == 1) {
      return _categoryCards(
        blockers
            .where(
              (b) => [
                'pos-order',
                'sync',
                'fnb-order',
                'pos-session',
                'frontdesk',
              ].contains(b['key']),
            )
            .toList(),
        'No system blockers remain.',
      );
    }
    if (step == 2) return _financial(data, blockers);
    return _cash(data, blockers);
  }

  Widget _operations(Map<String, dynamic> data) {
    final operational = map(data['operational']);
    final arrivals = list(operational['arrivals']);
    final departures = list(operational['departures']);
    final rooms = list(
      operational['roomReconciliation'],
    ).where((r) => map(r)['issue'] == true).toList();
    final reviewItems = <Map<String, dynamic>>[
      ...arrivals.map(
        (item) => {
          'key': 'arrival',
          'title': 'Pending arrival',
          'detail':
              'Check in, mark no-show, cancel, or update the reservation.',
          'item': map(item),
          'action': 'info',
        },
      ),
      ...departures.map(
        (item) => {
          'key': 'departure',
          'title': 'Pending departure',
          'detail': 'Check out the guest or extend the stay before closing.',
          'item': map(item),
          'action': 'info',
        },
      ),
      ...rooms.map(
        (item) => {
          'key': 'room-discrepancy',
          'title': 'Room discrepancy',
          'detail': 'Housekeeping and front-desk room statuses do not match.',
          'item': map(item),
          'action': 'info',
        },
      ),
    ];
    return Column(
      children: [
        _categoryCards(reviewItems, 'No operational items require review.'),
        const SizedBox(height: 4),
        _notice(
          'Pending arrivals and departures must be resolved before close. Room discrepancies remain operational follow-ups unless the server marks them as blockers.',
        ),
      ],
    );
  }

  Widget _financial(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> blockers,
  ) {
    final approvalCards = blockers
        .where(
          (b) => ['complimentary', 'discount', 'bypass'].contains(b['key']),
        )
        .toList();
    final inventoryCards = blockers
        .where((b) => b['key'] == 'guest-amenity')
        .toList();
    return Column(
      children: [
        _categoryCards(
          approvalCards,
          inventoryCards.isEmpty && approvalCards.isEmpty
              ? 'No financial blockers remain.'
              : 'No approval blockers remain.',
        ),
        if (inventoryCards.isNotEmpty) ...[
          const SizedBox(height: 4),
          _categoryCards(
            inventoryCards,
            'No complimentary inventory blockage remains.',
          ),
        ],
      ],
    );
  }

  Widget _cash(Map<String, dynamic> data, List<Map<String, dynamic>> blockers) {
    final cash = map(data['cash']);
    final items = <Map<String, dynamic>>[
      ...list(cash['unverifiedTransactions'])
          .where((item) => map(item)['verificationStatus'] == 'UNVERIFIED')
          .map(
            (item) => {
              'key': 'transaction',
              'title': 'Transaction verification',
              'detail': 'Review and verify this payment before closing.',
              'item': map(item),
              'action': 'transaction',
            },
          ),
      ...list(cash['cashHandovers']).map(
        (item) => {
          'key': 'cash-handover',
          'title': 'Pending cash handover',
          'detail':
              'Receive and acknowledge this handover with the General Cashier.',
          'item': map(item),
          'action': 'info',
        },
      ),
      ...list(cash['pendingCashDrops']).map(
        (item) => {
          'key': 'cash-drop',
          'title': 'Pending cash drop',
          'detail':
              'Confirm the physical cash drop with the responsible cashier.',
          'item': map(item),
          'action': 'info',
        },
      ),
    ];
    return _categoryCards(
      items,
      'All cash controls and payments are verified.',
    );
  }

  Widget _categoryCards(List<Map<String, dynamic>> items, String emptyMessage) {
    if (items.isEmpty) return _success(emptyMessage);
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final key = item['key']?.toString() ?? 'other';
      groups.putIfAbsent(key, () => []).add(item);
    }
    return Column(
      children: groups.entries.map((group) {
        final sample = group.value.first;
        final title = text(sample['title']).isNotEmpty
            ? text(sample['title'])
            : _categoryTitle(group.key);
        final color = _categoryColor(group.key);
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withValues(alpha: .28)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(_categoryIcon(group.key), color: color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: _text,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${group.value.length} record${group.value.length == 1 ? '' : 's'} require review',
                          style: const TextStyle(color: _muted, fontSize: 12),
                        ),
                        Text(
                          text(sample['detail']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: color.withValues(alpha: .85),
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _isWarningKey(group.key)
                              ? 'WARNING • does not block close'
                              : 'BLOCKER • must be resolved before close',
                          style: TextStyle(
                            color: color.withValues(alpha: .9),
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: .7,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => group.key == 'guest-amenity'
                      ? _reviewGuestAmenity(sample)
                      : group.key == 'cash-handover' || group.key == 'cash-drop'
                      ? _openCashInstructionScreen(
                          title,
                          group.key,
                          group.value,
                        )
                      : _openBlockerScreen(title, group.value),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: color,
                    side: BorderSide(color: color.withValues(alpha: .45)),
                  ),
                  icon: const Icon(Icons.visibility_rounded, size: 16),
                  label: Text(
                    group.key == 'cash-handover' || group.key == 'cash-drop'
                        ? 'View handling instructions'
                        : 'Review all records',
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  String _categoryTitle(String key) => switch (key) {
    'arrival' => 'Pending arrivals',
    'departure' => 'Pending departures',
    'room-discrepancy' => 'Room discrepancies',
    'pos-order' => 'Open POS orders',
    'fnb-order' => 'Open F&B orders',
    'pos-session' => 'Open POS sessions',
    'frontdesk' => 'Open front-desk shifts',
    'sync' => 'Financial sync conflicts',
    'complimentary' => 'Complimentary pending approval',
    'guest-amenity' => 'Guest complimentary inventory blockage',
    'bypass' => 'Check-in bypass pending approval',
    'transaction' => 'Transaction verification',
    'cash-handover' => 'Pending cash handover',
    'cash-drop' => 'Pending cash drop',
    _ => 'Review required',
  };

  bool _isWarningKey(String key) =>
      const {'room-discrepancy', 'cash-handover', 'cash-drop'}.contains(key);

  List<Map<String, dynamic>> _blockingItems(Map<String, dynamic> data) =>
      _blockers(
        data,
      ).where((item) => !_isWarningKey(text(item['key']))).toList();

  IconData _categoryIcon(String key) => switch (key) {
    'arrival' => Icons.login_rounded,
    'departure' => Icons.logout_rounded,
    'room-discrepancy' => Icons.cleaning_services_rounded,
    'pos-order' || 'fnb-order' => Icons.restaurant_rounded,
    'pos-session' || 'frontdesk' => Icons.point_of_sale_rounded,
    'sync' => Icons.sync_problem_rounded,
    'complimentary' => Icons.card_giftcard_rounded,
    'guest-amenity' => Icons.inventory_2_rounded,
    'bypass' => Icons.verified_user_rounded,
    'transaction' => Icons.receipt_long_rounded,
    'cash-handover' || 'cash-drop' => Icons.account_balance_wallet_rounded,
    _ => Icons.warning_amber_rounded,
  };

  Color _categoryColor(String key) => switch (key) {
    'room-discrepancy' => Colors.amberAccent,
    'arrival' || 'departure' => Colors.redAccent,
    'sync' ||
    'bypass' ||
    'transaction' ||
    'complimentary' ||
    'discount' ||
    'pos-order' ||
    'fnb-order' ||
    'pos-session' ||
    'frontdesk' => Colors.redAccent,
    'guest-amenity' => Colors.redAccent,
    'cash-handover' || 'cash-drop' => Colors.amberAccent,
    _ => Colors.orangeAccent,
  };

  Future<void> _openBlockerScreen(
    String title,
    List<Map<String, dynamic>> items,
  ) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => NightAuditBlockerDetailsScreen(
          title: title,
          items: items,
          onResolve: _resolve,
          onOpenModule: _openModule,
        ),
      ),
    );
    if (mounted) ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
  }

  Future<void> _openCashInstructionScreen(
    String title,
    String kind,
    List<Map<String, dynamic>> items,
  ) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CashControlInstructionScreen(
          title: title,
          kind: kind,
          items: items,
        ),
      ),
    );
  }

  Future<bool> _openModule(Map<String, dynamic> entry) async {
    final key = entry['key'];
    if (key == 'arrival' || key == 'departure') {
      return _resolveOperational(entry);
    }
    if (key == 'room-discrepancy') {
      return _resolveRoomDiscrepancy(entry);
    }
    if (key == 'guest-amenity') {
      return _reviewGuestAmenity(entry);
    }
    if (key == 'cash-handover' || key == 'cash-drop') {
      return _resolveCashFollowUp(entry);
    }
    if (key == 'sync' ||
        key == 'pos-session' ||
        key == 'frontdesk' ||
        key == 'fnb-order') {
      return _resolveSystemControl(entry);
    }
    final Widget screen;
    if (key == 'frontdesk') {
      screen = const FinanceScreen();
    } else {
      screen = const HubScreen();
    }
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    if (mounted) ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
    return false;
  }

  Future<bool> _resolveSystemControl(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final key = text(entry['key']);
    final title = switch (key) {
      'sync' => 'Resolve financial sync conflict',
      'pos-session' => 'Close POS session',
      'frontdesk' => 'Close front-desk shift',
      _ => 'Open F&B order',
    };
    final description = switch (key) {
      'sync' =>
        'Choose which version of this financial event should remain authoritative.',
      'pos-session' =>
        'Reconcile the cashier session before night audit can close.',
      'frontdesk' => 'Declare the drawer and close the front-desk shift.',
      _ =>
        'This order must be settled or voided by the responsible waiter at the POS terminal.',
    };
    final action = await showDialog<String>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (dialogContext) => _SystemControlDialog(
        title: title,
        description: description,
        kind: key,
        item: item,
        onClose: () => Navigator.pop(dialogContext),
      ),
    );
    if (action == null || !mounted) return false;

    if (key == 'fnb-order') {
      return false;
    }
    try {
      final repository = ref.read(nightAuditRepositoryProvider);
      if (key == 'sync') {
        await repository.resolveSyncConflict(
          conflictId: text(item['id']),
          action: action,
        );
      } else if (key == 'pos-session') {
        await repository.settlePosSession(
          sessionId: text(item['id']),
          actualCash: double.tryParse(action.split('|').first) ?? 0,
          reason: action.split('|').length > 1 ? action.split('|').last : null,
        );
      } else if (key == 'frontdesk') {
        await repository.closeFrontdeskShift(
          shiftId: text(item['id']),
          declaredCash: double.tryParse(action.split('|').first) ?? 0,
          reason: action.split('|').length > 1 ? action.split('|').last : null,
        );
      }
      if (!mounted) return true;
      ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('System control resolved and audit refreshed'),
          backgroundColor: Colors.green,
        ),
      );
      return true;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Resolution failed: $error'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return false;
    }
  }

  Future<bool> _resolveCashFollowUp(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final key = text(entry['key']);
    final isHandover = key == 'cash-handover';
    final title = isHandover ? 'Receive cash handover' : 'Confirm cash drop';
    final message = isHandover
        ? 'Confirm the physical handover reference and amount with the General Cashier. The custody transfer must be recorded before this item can be closed.'
        : 'Confirm the physical cash drop with the responsible cashier and record it through the cash-management workflow.';
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (dialogContext) => AlertDialog(
        backgroundColor: _card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Row(
          children: [
            Icon(
              Icons.account_balance_wallet_rounded,
              color: Colors.amberAccent,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(title, style: const TextStyle(color: _text)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message, style: const TextStyle(color: _muted, height: 1.4)),
            const SizedBox(height: 14),
            _cashDetail(
              'Reference',
              item['handoverReference'] ?? item['id'] ?? '—',
            ),
            _cashDetail(
              'Location',
              item['location'] ?? item['drawerName'] ?? '—',
            ),
            if (item['amount'] != null)
              _cashDetail('Amount', '₦${item['amount']}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close'),
          ),
        ],
      ),
    );
    return false;
  }

  Widget _cashDetail(String label, dynamic value) => Padding(
    padding: const EdgeInsets.only(top: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 82,
          child: Text(
            label,
            style: const TextStyle(color: _muted, fontSize: 11),
          ),
        ),
        Expanded(
          child: Text(
            value?.toString() ?? '—',
            style: const TextStyle(
              color: _text,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );

  Future<bool> _resolveRoomDiscrepancy(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final roomId = text(item['roomId'], '');
    final roomNumber = formatRoomNumber(
      text(item['roomNumber'], 'Room'),
      fallback: 'Room',
    );
    final pmsStatus = text(item['pmsStatus']);
    final housekeepingStatus = text(item['hkStatus']);
    final expectedStatus = text(item['expected']);
    if (roomId.isEmpty) return false;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (dialogContext) => Dialog(
        backgroundColor: _card,
        insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.amberAccent.withValues(alpha: .14),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.cleaning_services_rounded,
                        color: Colors.amberAccent,
                      ),
                    ),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Resolve room discrepancy',
                            style: TextStyle(
                              color: _text,
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            'Room $roomNumber needs PMS and housekeeping alignment.',
                            style: const TextStyle(
                              color: _muted,
                              height: 1.35,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      icon: const Icon(Icons.close_rounded, color: _muted),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.amberAccent.withValues(alpha: .07),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.amberAccent.withValues(alpha: .20),
                    ),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        color: Colors.amberAccent,
                        size: 19,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'This action reconciles the room for night audit. It does not check in or check out a guest.',
                          style: TextStyle(
                            color: _text,
                            height: 1.4,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'STATUS COMPARISON',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 9),
                Row(
                  children: [
                    Expanded(
                      child: _statusTile(
                        'PMS status',
                        pmsStatus,
                        Colors.lightBlueAccent,
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: _statusTile(
                        'Housekeeping',
                        housekeepingStatus,
                        Colors.orangeAccent,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 9),
                _statusTile(
                  'Expected PMS status',
                  expectedStatus,
                  Colors.greenAccent,
                  fullWidth: true,
                ),
                const SizedBox(height: 20),
                const Text(
                  'RESOLUTION',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Set PMS status to $expectedStatus and housekeeping to ${expectedStatus == 'OCCUPIED' ? 'PENDING' : 'CLEAN'}.',
                  style: const TextStyle(
                    color: _muted,
                    height: 1.4,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => Navigator.pop(dialogContext, true),
                    icon: const Icon(Icons.check_circle_outline_rounded),
                    label: const Text('Reconcile room status'),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.green.shade700,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(height: 5),
                SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    child: const Text('Keep unresolved'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) return false;

    try {
      await ref
          .read(nightAuditRepositoryProvider)
          .reconcileRoom(
            roomId: roomId,
            expectedStatus: expectedStatus,
            targetHousekeepingStatus: expectedStatus == 'OCCUPIED'
                ? 'PENDING'
                : 'CLEAN',
          );
      if (!mounted) return true;
      ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Room $roomNumber reconciled successfully'),
          backgroundColor: Colors.green.shade700,
        ),
      );
      return true;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Room reconciliation failed: $error'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
      return false;
    }
  }

  Widget _statusTile(
    String label,
    String value,
    Color color, {
    bool fullWidth = false,
  }) => Container(
    width: fullWidth ? double.infinity : null,
    padding: const EdgeInsets.all(13),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .07),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: color.withValues(alpha: .20)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            color: _text,
            fontSize: 13,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );

  Future<bool> _resolveOperational(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final guest = map(item['primaryGuest']);
    final isArrival = entry['key'] == 'arrival';
    final firstName = text(guest['firstName'], 'Guest');
    final lastName = text(guest['lastName'], '');
    final action = await showDialog<String>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (dialogContext) => Dialog(
        backgroundColor: _card,
        insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(22, 22, 18, 20),
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(28),
                    ),
                    gradient: LinearGradient(
                      colors: [
                        (isArrival
                                ? Colors.lightBlueAccent
                                : Colors.orangeAccent)
                            .withValues(alpha: .20),
                        _card,
                      ],
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color:
                              (isArrival
                                      ? Colors.lightBlueAccent
                                      : Colors.orangeAccent)
                                  .withValues(alpha: .16),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Icon(
                          isArrival
                              ? Icons.login_rounded
                              : Icons.logout_rounded,
                          color: isArrival
                              ? Colors.lightBlueAccent
                              : Colors.orangeAccent,
                        ),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isArrival
                                  ? 'Arrival control'
                                  : 'Departure control',
                              style: TextStyle(
                                color: isArrival
                                    ? Colors.lightBlueAccent
                                    : Colors.orangeAccent,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.1,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isArrival
                                  ? 'Resolve pending arrival'
                                  : 'Resolve pending departure',
                              style: const TextStyle(
                                color: _text,
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(dialogContext),
                        icon: const Icon(Icons.close_rounded, color: _muted),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .04),
                          borderRadius: BorderRadius.circular(17),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: .07),
                          ),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: _gold.withValues(alpha: .16),
                              child: Text(
                                firstName.substring(0, 1).toUpperCase(),
                                style: const TextStyle(
                                  color: _gold,
                                  fontSize: 19,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$firstName $lastName'.trim(),
                                    style: const TextStyle(
                                      color: _text,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Reservation guest',
                                    style: const TextStyle(
                                      color: _muted,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _dialogPill(
                            Icons.confirmation_number_outlined,
                            text(item['confirmationNumber'], 'No confirmation'),
                          ),
                          _dialogPill(
                            Icons.hotel_rounded,
                            'Room ${formatRoomNumber(text(item['roomNumber'], 'Unassigned'))}',
                          ),
                          _dialogPill(
                            Icons.calendar_today_rounded,
                            isArrival ? 'Arrives today' : 'Departs today',
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(13),
                        decoration: BoxDecoration(
                          color: Colors.amberAccent.withValues(alpha: .07),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: Colors.amberAccent.withValues(alpha: .18),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.info_outline_rounded,
                              color: Colors.amberAccent,
                              size: 18,
                            ),
                            const SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                isArrival
                                    ? 'Choose the correct arrival outcome. This decision is recorded in the audit trail.'
                                    : 'Review the guest balance and stay status before choosing a departure outcome.',
                                style: const TextStyle(
                                  color: Colors.amberAccent,
                                  fontSize: 12,
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        isArrival ? 'AVAILABLE ACTIONS' : 'DEPARTURE OPTIONS',
                        style: const TextStyle(
                          color: _muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 9),
                      if (isArrival) ...[
                        _resolutionAction(
                          dialogContext,
                          'late-arrival',
                          Icons.schedule_rounded,
                          'Late arrival',
                          'Keep the reservation active for a later arrival.',
                          Colors.lightBlueAccent,
                        ),
                        _resolutionAction(
                          dialogContext,
                          'cancel',
                          Icons.cancel_outlined,
                          'Cancel reservation',
                          'Cancel the reservation with the existing policy applied.',
                          Colors.orangeAccent,
                        ),
                        _resolutionAction(
                          dialogContext,
                          'no-show',
                          Icons.person_off_rounded,
                          'Mark as no-show',
                          'Close the arrival as a guest no-show.',
                          Colors.redAccent,
                        ),
                      ] else ...[
                        _resolutionAction(
                          dialogContext,
                          'extend',
                          Icons.nights_stay_rounded,
                          'Extend one night',
                          'Move checkout forward by one night.',
                          Colors.lightBlueAccent,
                        ),
                        _resolutionAction(
                          dialogContext,
                          'check-out',
                          Icons.check_circle_outline_rounded,
                          'Check out guest',
                          'Complete checkout for the current business date.',
                          Colors.greenAccent,
                        ),
                      ],
                      const SizedBox(height: 8),
                      Center(
                        child: TextButton(
                          onPressed: () => Navigator.pop(dialogContext),
                          child: const Text('Keep unresolved'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (action == null || !mounted) return false;
    try {
      final repository = ref.read(nightAuditRepositoryProvider);
      final reservationId = text(item['id']);
      if (action == 'extend') {
        final checkout = DateTime.tryParse(text(item['checkOut']));
        final nextDate = (checkout ?? DateTime.now()).add(
          const Duration(days: 1),
        );
        await repository.reservationAction(
          reservationId,
          action,
          data: {
            'newCheckoutDate': nextDate.toIso8601String().split('T').first,
          },
        );
      } else {
        await repository.reservationAction(reservationId, action);
      }
      if (mounted) {
        ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reservation updated and audit data refreshed'),
            backgroundColor: Colors.green,
          ),
        );
      }
      return true;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString()),
            backgroundColor: Colors.red,
          ),
        );
      }
      return false;
    }
  }

  Widget _dialogPill(IconData icon, String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .05),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: _muted),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            color: _muted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );

  Widget _resolutionAction(
    BuildContext context,
    String value,
    IconData icon,
    String title,
    String subtitle,
    Color color,
  ) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    child: OutlinedButton(
      onPressed: () => Navigator.pop(context, value),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.all(13),
        alignment: Alignment.centerLeft,
        side: BorderSide(color: color.withValues(alpha: .30)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: color,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(color: _muted, fontSize: 11),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: _muted, size: 20),
        ],
      ),
    ),
  );

  Widget _signOff(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> blockers,
  ) {
    final summary = map(data['summary']);
    final serverBlockers = count(summary['blockers']);
    final blockingItems = blockers
        .where((item) => !_isWarningKey(text(item['key'])))
        .length;
    final blocked = serverBlockers > 0 || blockingItems > 0;
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: blocked
                  ? [const Color(0xFF3A2B1D), _card]
                  : [const Color(0xFF12362F), _card],
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: (blocked ? Colors.orangeAccent : Colors.greenAccent)
                  .withValues(alpha: .28),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color:
                          (blocked ? Colors.orangeAccent : Colors.greenAccent)
                              .withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      blocked
                          ? Icons.lock_outline_rounded
                          : Icons.verified_rounded,
                      color: blocked ? Colors.orangeAccent : Colors.greenAccent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          blocked ? 'Action required' : 'Ready for sign-off',
                          style: const TextStyle(
                            color: _text,
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          blocked
                              ? 'Resolve the controls below before execution.'
                              : 'All controls passed. Review charges before posting.',
                          style: const TextStyle(color: _muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  _signOffMetric(
                    'Blockers',
                    '${serverBlockers + blockingItems}',
                    blocked ? Colors.orangeAccent : Colors.greenAccent,
                  ),
                  const SizedBox(width: 10),
                  _signOffMetric('Stage', '5 of 5', _gold),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      blocked ? 'Execution locked' : 'Ready to review',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: blocked
                            ? Colors.orangeAccent
                            : Colors.greenAccent,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _notice(
          'Execution is protected by the server permission and blocker checks. No charge is posted until you confirm the final step.',
        ),
      ],
    );
  }

  Widget _signOffMetric(String label, String value, Color color) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label.toUpperCase(),
        style: TextStyle(
          color: color.withValues(alpha: .72),
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: .7,
        ),
      ),
      const SizedBox(height: 3),
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 15,
          fontWeight: FontWeight.w900,
        ),
      ),
    ],
  );

  Widget _bottomBar(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> blockers,
  ) {
    final serverBlockers = count(map(data['summary'])['blockers']);
    final blocked =
        serverBlockers > 0 ||
        blockers.any((item) => !_isWarningKey(text(item['key'])));
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
        decoration: const BoxDecoration(
          color: _bg,
          border: Border(top: BorderSide(color: Color(0xFF1E3355))),
        ),
        child: Row(
          children: [
            if (step > 0)
              OutlinedButton(
                onPressed: () => setState(() => step--),
                child: const Icon(Icons.arrow_back_rounded),
              )
            else
              OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: step == 4
                    ? (blocked || confirming
                          ? null
                          : () => _openRoomChargesReview(data))
                    : () => setState(() => step++),
                style: FilledButton.styleFrom(
                  backgroundColor: step == 4 ? Colors.green : _gold,
                  foregroundColor: _bg,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: confirming
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(step == 4 ? 'Execute Night Audit' : 'Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openRoomChargesReview(Map<String, dynamic> data) async {
    final charges = list(
      map(data['financial'])['pendingNightAuditPostings'],
    ).map(map).toList();
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RoomChargesReviewScreen(
          businessDate: text(data['businessDate']),
          charges: charges,
          blocked:
              _blockingItems(data).isNotEmpty ||
              count(map(data['summary'])['blockers']) > 0,
          onExecute: _execute,
        ),
      ),
    );
  }

  Future<void> _execute() async {
    setState(() => confirming = true);
    try {
      await ref
          .read(nightAuditExecutionProvider.notifier)
          .execute(widget.propertyId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Night Audit completed successfully'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString()),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => confirming = false);
    }
  }

  Future<bool> _resolve(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final action = entry['action'];
    if (action == 'discount') {
      return _resolveDiscount(entry);
    }
    if (action == 'transaction') {
      return _resolveTransaction(entry);
    }
    final notes = TextEditingController();
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: _card,
        title: Text(text(entry['title']), style: const TextStyle(color: _text)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Review ${{'void': 'the order before voiding it', 'complimentary': 'the complimentary record', 'bypass': 'the check-in bypass', 'transaction': 'the transaction'}[action] ?? 'this record'}.',
              style: const TextStyle(color: _muted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notes,
              minLines: 2,
              maxLines: 4,
              style: const TextStyle(color: _text),
              decoration: const InputDecoration(
                labelText: 'Review note / reason',
                labelStyle: TextStyle(color: _muted),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (approved != true || !mounted) return false;
    try {
      final repository = ref.read(nightAuditRepositoryProvider);
      if (action == 'void') {
        await repository.voidPosOrder(
          orderId: text(item['id']),
          propertyId: widget.propertyId,
          reason: notes.text.trim().isEmpty
              ? 'Reviewed during mobile Night Audit'
              : notes.text,
        );
      }
      if (action == 'transaction') {
        await repository.verifyTransaction(
          propertyId: widget.propertyId,
          transactionId: text(item['id']),
          type: item['order'] != null ? 'POS_PAYMENT' : 'PAYMENT',
          status: 'VERIFIED',
          notes: notes.text,
        );
      }
      if (action == 'bypass') {
        await repository.verifyCheckInBypass(
          propertyId: widget.propertyId,
          bypassId: text(item['id']),
          action: 'VERIFY',
          notes: notes.text,
        );
      }
      if (action == 'complimentary') {
        await repository.updateComplimentary(
          propertyId: widget.propertyId,
          recordId: text(item['id']),
          status: 'VERIFIED',
        );
      }
      ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Control resolved and audit data refreshed'),
            backgroundColor: Colors.green,
          ),
        );
      }
      return true;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString()),
            backgroundColor: Colors.red,
          ),
        );
      }
      return false;
    }
  }

  Future<bool> _resolveTransaction(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final result = await showDialog<Map<String, String>>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (dialogContext) => _TransactionVerificationDialog(
        item: item,
        onClose: () => Navigator.pop(dialogContext),
      ),
    );
    if (result == null || !mounted) return false;
    try {
      await ref
          .read(nightAuditRepositoryProvider)
          .verifyTransaction(
            propertyId: widget.propertyId,
            transactionId: text(item['id']),
            type: item['order'] != null ? 'POS_PAYMENT' : 'PAYMENT',
            status: result['status']!,
            notes: result['notes'],
          );
      ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result['status'] == 'VERIFIED'
                  ? 'Transaction verified successfully'
                  : 'Transaction questioned and sent for follow-up',
            ),
            backgroundColor: result['status'] == 'VERIFIED'
                ? Colors.green
                : Colors.orange,
          ),
        );
      }
      return true;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Transaction update failed: $error'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return false;
    }
  }

  Future<bool> _resolveDiscount(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final details = map(item['details']);
    final decision = await showDialog<String>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (dialogContext) => _FinancialControlDialog(
        title: 'Review discount approval',
        subtitle:
            'A management decision is required before room charges can be posted.',
        accent: Colors.amberAccent,
        fields: {
          'Type': text(details['targetType'], 'RESERVATION_ROOM'),
          'Requested by': text(item['requestedByName'] ?? item['requestedBy']),
          'Acknowledged by': text(
            item['acknowledgedByName'],
            'Not acknowledged',
          ),
          'Reason': text(
            item['reason'] ?? details['reason'],
            'No reason provided',
          ),
        },
        actions: const {
          'Reject discount': 'reject',
          'Approve discount': 'approve',
        },
        onClose: () => Navigator.pop(dialogContext),
      ),
    );
    if (decision == null || !mounted) return false;
    try {
      await ref
          .read(nightAuditRepositoryProvider)
          .resolveDiscountApproval(
            approvalId: text(item['id']),
            action: decision,
          );
      ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Discount approval updated'),
            backgroundColor: Colors.green,
          ),
        );
      }
      return true;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Discount update failed: $error'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return false;
    }
  }

  Future<bool> _reviewGuestAmenity(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (dialogContext) => _GuestAmenityDialog(
        item: item,
        onClose: () => Navigator.pop(dialogContext),
      ),
    );
    return false;
  }

  Widget _success(String message) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.green.withValues(alpha: .08),
      borderRadius: BorderRadius.circular(15),
      border: Border.all(color: Colors.green.withValues(alpha: .25)),
    ),
    child: Row(
      children: [
        const Icon(Icons.check_circle_rounded, color: Colors.greenAccent),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(
              color: Colors.greenAccent,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );
  Widget _notice(String message) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFF1B263D),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Text(
      message,
      style: const TextStyle(color: _muted, fontSize: 12, height: 1.4),
    ),
  );
}

class _TransactionVerificationDialog extends StatefulWidget {
  final Map<String, dynamic> item;
  final VoidCallback onClose;

  const _TransactionVerificationDialog({
    required this.item,
    required this.onClose,
  });

  @override
  State<_TransactionVerificationDialog> createState() =>
      _TransactionVerificationDialogState();
}

class _TransactionVerificationDialogState
    extends State<_TransactionVerificationDialog> {
  final notes = TextEditingController();
  bool questioning = false;

  @override
  void dispose() {
    notes.dispose();
    super.dispose();
  }

  String _value(dynamic value, [String fallback = 'N/A']) =>
      value == null || value.toString().trim().isEmpty
      ? fallback
      : value.toString();

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final order = item['order'] is Map
        ? Map<String, dynamic>.from(item['order'] as Map)
        : <String, dynamic>{};
    final folio = item['folio'] is Map
        ? Map<String, dynamic>.from(item['folio'] as Map)
        : <String, dynamic>{};
    final reservation = _map(folio['reservation']);
    final guest = reservation['primaryGuest'];
    final guestMap = guest is Map
        ? Map<String, dynamic>.from(guest)
        : <String, dynamic>{};
    final reservationRooms = reservation['reservationRooms'] is List
        ? reservation['reservationRooms'] as List
        : const [];
    final firstRoom =
        reservationRooms.isNotEmpty && reservationRooms.first is Map
        ? _map(reservationRooms.first)
        : <String, dynamic>{};
    final room = _map(firstRoom['room']);
    final roomNumber = formatRoomNumber(
      room['number'] ?? reservation['roomNumber'] ?? folio['roomNumber'],
      fallback: 'N/A',
    );
    final pos = item['order'] != null;
    final operator = pos
        ? _map(_map(item['session'])['operator'])
        : _map(_map(item['frontdeskSession'])['staff']);
    final cashier =
        '${operator['firstName'] ?? ''} ${operator['lastName'] ?? ''}'.trim();
    final reference =
        item['reference'] ??
        item['providerRef'] ??
        item['providerTransactionId'] ??
        'N/A';
    final location = pos
        ? _map(order['outlet'])['name'] ?? 'POS outlet'
        : 'Front Desk';
    final record = pos
        ? 'Order: ${order['receiptNumber'] ?? order['id'] ?? 'N/A'}'
        : 'Folio: ${folio['folioNumber'] ?? 'N/A'}';
    return Dialog(
      backgroundColor: _card,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: Colors.indigoAccent.withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: const Icon(
                      Icons.verified_user_rounded,
                      color: Colors.indigoAccent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Transaction verification',
                      style: TextStyle(
                        color: _text,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: widget.onClose,
                    icon: const Icon(Icons.close_rounded, color: _muted),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Review the payment evidence before closing the business date. Verify only when the receipt and supporting record agree.',
                style: TextStyle(color: _muted, fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .035),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .08),
                  ),
                ),
                child: Column(
                  children: [
                    _transactionRow(
                      'Amount',
                      '₦${_value(item['amount'], '0')}',
                    ),
                    _transactionRow(
                      'Method',
                      item['method'] == 'BANK_TRANSFER'
                          ? 'Bank Transfer'
                          : _value(item['method'], 'POS'),
                    ),
                    _transactionRow('Reference', reference),
                    _transactionRow(
                      'Date / time',
                      _displayDateTime(item['createdAt']),
                    ),
                    const Divider(color: Colors.white12, height: 22),
                    _transactionRow(
                      'Cashier',
                      cashier.isEmpty ? 'System' : cashier,
                    ),
                    _transactionRow('Location', location),
                    _transactionRow(
                      'Shift reference',
                      pos
                          ? _map(item['session'])['shiftReference']
                          : _map(item['frontdeskSession'])['shiftReference'],
                    ),
                    _transactionRow(
                      'Guest / account',
                      '${guestMap['firstName'] ?? ''} ${guestMap['lastName'] ?? ''}'
                              .trim()
                              .isEmpty
                          ? 'N/A'
                          : '${guestMap['firstName'] ?? ''} ${guestMap['lastName'] ?? ''}',
                    ),
                    _transactionRow('Room number', roomNumber),
                    _transactionRow('Record', record),
                  ],
                ),
              ),
              if (questioning) ...[
                const SizedBox(height: 14),
                const Text(
                  'Reason / observation (required)',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 7),
                TextField(
                  controller: notes,
                  minLines: 3,
                  maxLines: 5,
                  style: const TextStyle(color: _text, fontSize: 12),
                  decoration: const InputDecoration(
                    hintText: 'e.g. Reference does not match the receipt...',
                    hintStyle: TextStyle(color: _muted),
                    filled: true,
                    fillColor: Colors.white12,
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() => questioning = true),
                      icon: const Icon(Icons.help_outline_rounded),
                      label: const Text('Question'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.amberAccent,
                        side: BorderSide(
                          color: Colors.amberAccent.withValues(alpha: .4),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        if (questioning && notes.text.trim().isEmpty) return;
                        Navigator.pop(context, {
                          'status': questioning ? 'QUESTIONED' : 'VERIFIED',
                          'notes': notes.text.trim(),
                        });
                      },
                      icon: Icon(
                        questioning
                            ? Icons.flag_rounded
                            : Icons.check_circle_rounded,
                      ),
                      label: Text(questioning ? 'Submit question' : 'Verify'),
                      style: FilledButton.styleFrom(
                        backgroundColor: questioning
                            ? Colors.amber.shade800
                            : Colors.green.shade700,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
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

  Widget _transactionRow(String label, dynamic value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: _muted,
              fontSize: 10,
              letterSpacing: .7,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            _value(value),
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: _text,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );

  static Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
}

class CashControlDialog extends StatelessWidget {
  final Map<String, dynamic> cash;
  final int unverifiedCount;
  final num unverifiedTotal;
  final VoidCallback onClose;

  const CashControlDialog({
    super.key,
    required this.cash,
    required this.unverifiedCount,
    required this.unverifiedTotal,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final handovers = _list(cash['cashHandovers']);
    final drops = _list(cash['pendingCashDrops']);
    final transactions = _list(cash['unverifiedTransactions'])
        .where((item) => _map(item)['verificationStatus'] == 'UNVERIFIED')
        .toList();
    final isBlocked = transactions.isNotEmpty;
    return Dialog(
      backgroundColor: _card,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: (isBlocked ? Colors.redAccent : Colors.amberAccent)
                          .withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Icon(
                      Icons.account_balance_wallet_rounded,
                      color: isBlocked ? Colors.redAccent : Colors.amberAccent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Cash control review',
                      style: TextStyle(
                        color: _text,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: onClose,
                    icon: const Icon(Icons.close_rounded, color: _muted),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                isBlocked
                    ? 'Payment verification is blocking close. Confirm each receipt with the responsible cashier before signing off.'
                    : 'Review the cash follow-ups for this audit date. Warnings can be completed by the cashier or General Cashier after review.',
                style: const TextStyle(
                  color: _muted,
                  height: 1.4,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 16),
              _cashMetric(
                'Unverified payments',
                '$unverifiedCount · ₦${unverifiedTotal.toStringAsFixed(0)}',
                isBlocked ? Colors.redAccent : Colors.greenAccent,
                isBlocked
                    ? Icons.lock_outline_rounded
                    : Icons.check_circle_rounded,
              ),
              const SizedBox(height: 14),
              _cashSection(
                title: 'TRANSACTION VERIFICATION',
                subtitle: 'Blocking until each payment is verified.',
                color: Colors.redAccent,
                children: transactions.isEmpty
                    ? [
                        const Text(
                          'No unverified transactions.',
                          style: TextStyle(color: _muted, fontSize: 12),
                        ),
                      ]
                    : transactions.take(8).map((item) {
                        final row = _map(item);
                        return _cashLine(
                          '${row['method'] ?? 'Payment'} · ₦${row['amount'] ?? 0}',
                          '${row['reference'] ?? row['id'] ?? 'No reference'} · ${row['cashierName'] ?? 'Assigned cashier'}',
                        );
                      }).toList(),
              ),
              const SizedBox(height: 12),
              _cashSection(
                title: 'PENDING CASH HANDOVERS',
                subtitle:
                    'Notice: receive and acknowledge with the General Cashier.',
                color: Colors.amberAccent,
                children: handovers.isEmpty
                    ? [
                        const Text(
                          'No pending handovers.',
                          style: TextStyle(color: _muted, fontSize: 12),
                        ),
                      ]
                    : handovers.take(8).map((item) {
                        final row = _map(item);
                        final person = _map(row['handedOverBy']);
                        return _cashLine(
                          row['drawerName']?.toString() ??
                              row['location']?.toString() ??
                              'Cash drawer',
                          'Handed over by ${'${person['firstName'] ?? ''} ${person['lastName'] ?? ''}'.trim().isEmpty ? 'assigned cashier' : '${person['firstName'] ?? ''} ${person['lastName'] ?? ''}'}',
                        );
                      }).toList(),
              ),
              const SizedBox(height: 12),
              _cashSection(
                title: 'PENDING CASH DROPS',
                subtitle:
                    'Confirm the physical drop with the responsible cashier.',
                color: Colors.amberAccent,
                children: drops.isEmpty
                    ? [
                        const Text(
                          'No pending cash drops.',
                          style: TextStyle(color: _muted, fontSize: 12),
                        ),
                      ]
                    : drops.take(8).map((item) {
                        final row = _map(item);
                        return _cashLine(
                          '₦${row['amount'] ?? 0} · ${row['location'] ?? 'Cash point'}',
                          'Dropped by ${row['cashierName'] ?? 'assigned cashier'}',
                        );
                      }).toList(),
              ),
              const SizedBox(height: 16),
              const Text(
                'NEXT ACTION',
                style: TextStyle(
                  color: _muted,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '1. Verify payment receipts with the cashier or front desk.\n'
                '2. Ask the General Cashier to receive pending handovers.\n'
                '3. Confirm pending cash drops physically and record receipt.\n'
                '4. Refresh this step before continuing to sign-off.',
                style: TextStyle(color: _muted, fontSize: 12, height: 1.5),
              ),
              const SizedBox(height: 15),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: onClose,
                  icon: const Icon(Icons.done_rounded),
                  label: const Text('Close review'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isBlocked
                        ? Colors.redAccent
                        : Colors.amberAccent,
                    side: BorderSide(
                      color: (isBlocked ? Colors.redAccent : Colors.amberAccent)
                          .withValues(alpha: .45),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cashMetric(String label, String value, Color color, IconData icon) =>
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: .22)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  color: _text,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              value,
              style: TextStyle(color: color, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      );

  Widget _cashSection({
    required String title,
    required String subtitle,
    required Color color,
    required List<Widget> children,
  }) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .035),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: color.withValues(alpha: .16)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.05,
          ),
        ),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(color: _muted, fontSize: 11)),
        const SizedBox(height: 9),
        ...children,
      ],
    ),
  );

  Widget _cashLine(String primary, String secondary) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          primary,
          style: const TextStyle(
            color: _text,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(secondary, style: const TextStyle(color: _muted, fontSize: 11)),
      ],
    ),
  );

  static Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  static List<dynamic> _list(dynamic value) => value is List ? value : const [];
}

class _GuestAmenityDialog extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onClose;

  const _GuestAmenityDialog({required this.item, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final warehouse = item['warehouse'] is Map
        ? Map<String, dynamic>.from(item['warehouse'] as Map)
        : <String, dynamic>{};
    final blockers = item['blockers'] is List
        ? item['blockers'] as List
        : const [];
    final inventory = item['items'] is List ? item['items'] as List : const [];
    final outOfStock = inventory.where((stock) {
      final row = stock is Map
          ? Map<String, dynamic>.from(stock)
          : <String, dynamic>{};
      final available = num.tryParse('${row['available'] ?? 0}') ?? 0;
      final status = row['status']?.toString().toLowerCase() ?? '';
      return available <= 0 ||
          status.contains('out') ||
          status.contains('unavailable') ||
          status.contains('insufficient');
    }).toList();
    return Dialog(
      backgroundColor: _card,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: const Icon(
                      Icons.inventory_2_rounded,
                      color: Colors.redAccent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Complimentary guest amenities',
                      style: TextStyle(
                        color: _text,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: onClose,
                    icon: const Icon(Icons.close_rounded, color: _muted),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'This is a blocking inventory control. The night audit cannot post the complimentary guest entitlement until the warehouse and mapped stock are available.',
                style: TextStyle(color: _muted, height: 1.4, fontSize: 12),
              ),
              const SizedBox(height: 17),
              _amenityRow(
                'Warehouse',
                warehouse['name']?.toString() ?? 'Not configured',
              ),
              _amenityRow('Guests', item['guestCount']?.toString() ?? '—'),
              _amenityRow('Estimated COGS', '₦${item['estimatedCost'] ?? 0}'),
              const SizedBox(height: 16),
              const Text(
                'BLOCKING REASONS',
                style: TextStyle(
                  color: _muted,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              ...blockers.map(
                (reason) => Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Text(
                    '• ${reason.toString()}',
                    style: const TextStyle(
                      color: Colors.redAccent,
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                ),
              ),
              if (inventory.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'INVENTORY CHECK',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                ...inventory.take(8).map((stock) {
                  final row = stock is Map
                      ? Map<String, dynamic>.from(stock)
                      : <String, dynamic>{};
                  return _amenityRow(
                    row['name']?.toString() ?? 'Amenity',
                    '${row['available'] ?? 0} available · ${row['status'] ?? 'CHECK'}',
                  );
                }),
              ],
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.redAccent.withValues(alpha: .22),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'OUT-OF-STOCK / ACTION REQUIRED',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.05,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (outOfStock.isEmpty)
                      const Text(
                        'The warehouse or recipe mapping is incomplete. Ask the managers to verify the stock setup.',
                        style: TextStyle(
                          color: _muted,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      )
                    else
                      ...outOfStock.take(8).map((stock) {
                        final row = stock is Map
                            ? Map<String, dynamic>.from(stock)
                            : <String, dynamic>{};
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 5),
                          child: Text(
                            '• ${row['name']?.toString() ?? 'Amenity'} — ${row['available'] ?? 0} available',
                            style: const TextStyle(
                              color: _text,
                              fontSize: 12,
                              height: 1.35,
                            ),
                          ),
                        );
                      }),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'RECOMMENDED RESOLUTION',
                style: TextStyle(
                  color: _muted,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '1. Contact the Stock Manager to confirm the required item and quantity.\n'
                '2. Contact the Outlet Warehouse Manager to arrange a stock transfer or restock.\n'
                '3. Confirm the transfer is received and the recipe/warehouse mapping is correct.\n'
                '4. Refresh this audit step before continuing. Do not bypass the deduction.',
                style: TextStyle(color: _muted, fontSize: 12, height: 1.5),
              ),
              const SizedBox(height: 15),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: onClose,
                  icon: const Icon(Icons.info_outline_rounded),
                  label: const Text('Close review'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.redAccent,
                    side: BorderSide(
                      color: Colors.redAccent.withValues(alpha: .45),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              const SizedBox(
                width: double.infinity,
                child: Text(
                  'Resolve the warehouse or stock configuration, then refresh this step. This review does not bypass inventory deduction.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: _muted, fontSize: 11, height: 1.35),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _amenityRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: _text,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );
}

class _FinancialControlDialog extends StatelessWidget {
  final String title;
  final String subtitle;
  final Color accent;
  final Map<String, String> fields;
  final Map<String, String> actions;
  final VoidCallback onClose;

  const _FinancialControlDialog({
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.fields,
    required this.actions,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) => Dialog(
    backgroundColor: _card,
    insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 460),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Icon(Icons.account_balance_rounded, color: accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: _text,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: onClose,
                  icon: const Icon(Icons.close_rounded, color: _muted),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              subtitle,
              style: const TextStyle(color: _muted, height: 1.4, fontSize: 12),
            ),
            const SizedBox(height: 17),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: .08)),
              ),
              child: Column(
                children: fields.entries
                    .map(
                      (field) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                field.key,
                                style: const TextStyle(
                                  color: _muted,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Flexible(
                              child: Text(
                                field.value,
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                  color: _text,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 18),
            ...actions.entries.map(
              (action) => Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, action.value),
                    style: FilledButton.styleFrom(
                      backgroundColor: action.value == 'approve'
                          ? Colors.indigoAccent
                          : Colors.redAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(
                      action.key,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: onClose,
                child: const Text('Keep unresolved'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _SystemControlDialog extends StatefulWidget {
  final String title;
  final String description;
  final String kind;
  final Map<String, dynamic> item;
  final VoidCallback onClose;

  const _SystemControlDialog({
    required this.title,
    required this.description,
    required this.kind,
    required this.item,
    required this.onClose,
  });

  @override
  State<_SystemControlDialog> createState() => _SystemControlDialogState();
}

class _SystemControlDialogState extends State<_SystemControlDialog> {
  late final TextEditingController cashController;
  late final TextEditingController reasonController;

  @override
  void initState() {
    super.initState();
    cashController = TextEditingController();
    reasonController = TextEditingController();
  }

  @override
  void dispose() {
    cashController.dispose();
    reasonController.dispose();
    super.dispose();
  }

  String value(dynamic input, [String fallback = '—']) {
    if (input == null || input.toString().trim().isEmpty) return fallback;
    return input.toString();
  }

  @override
  Widget build(BuildContext context) {
    final isSync = widget.kind == 'sync';
    final isCash = widget.kind == 'pos-session' || widget.kind == 'frontdesk';
    final expected =
        num.tryParse(
          value(
            widget.item['expectedCash'] ?? widget.item['systemExpectedCash'],
            '0',
          ),
        ) ??
        0;
    return Dialog(
      backgroundColor: _card,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: (isSync ? Colors.redAccent : Colors.indigoAccent)
                          .withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Icon(
                      isSync
                          ? Icons.sync_problem_rounded
                          : Icons.point_of_sale_rounded,
                      color: isSync ? Colors.redAccent : Colors.indigoAccent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        color: _text,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: widget.onClose,
                    icon: const Icon(Icons.close_rounded, color: _muted),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                widget.description,
                style: const TextStyle(
                  color: _muted,
                  height: 1.4,
                  fontSize: 12,
                ),
              ),
              if (widget.kind == 'pos-session') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.indigoAccent.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(
                      color: Colors.indigoAccent.withValues(alpha: .22),
                    ),
                  ),
                  child: const Text(
                    'Open POS orders are reviewed separately from this cashier session.',
                    style: TextStyle(color: _text, fontSize: 11, height: 1.35),
                  ),
                ),
              ],
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .04),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .08),
                  ),
                ),
                child: Column(
                  children: [
                    _row(
                      'Reference',
                      value(
                        widget.item['orderNumber'] ??
                            widget.item['shiftReference'] ??
                            widget.item['id'],
                      ),
                    ),
                    if (widget.item['outletName'] != null)
                      _row('Outlet', value(widget.item['outletName'])),
                    if (widget.item['openedByName'] != null)
                      _row('Opened by', value(widget.item['openedByName'])),
                    if (widget.kind == 'pos-session') ...[
                      _row(
                        'Session status',
                        value(widget.item['status'], 'OPEN'),
                      ),
                      _row(
                        'Banking model',
                        value(
                          widget.item['bankingModel'] ??
                              widget.item['bankType'],
                          'Not recorded',
                        ),
                      ),
                      _row(
                        'Terminal',
                        value(
                          mapValue(widget.item['device'])['name'],
                          'Not recorded',
                        ),
                      ),
                      _row('Opening cash', _money(widget.item['openingCash'])),
                      _row('Cash sales', _money(widget.item['cashSales'])),
                    ],
                    if (widget.kind == 'frontdesk') ...[
                      _row(
                        'Shift status',
                        value(widget.item['status'], 'OPEN'),
                      ),
                      _row(
                        'Staff',
                        value(widget.item['staffName'], 'Not recorded'),
                      ),
                      _row(
                        'Opened',
                        widget.item['openedAt'] == null
                            ? 'Not recorded'
                            : _displayDateTime(widget.item['openedAt']),
                      ),
                      _row(
                        'Shift reference',
                        value(widget.item['shiftReference'], 'Not recorded'),
                      ),
                      _row(
                        'Opening float',
                        _money(widget.item['openingFloat']),
                      ),
                      _row(
                        'Cash receipts',
                        _money(widget.item['cashReceipts']),
                      ),
                      _row(
                        'Cash in / transfers',
                        _money(widget.item['cashIn']),
                      ),
                      _row('Cash out / drops', _money(widget.item['cashOut'])),
                    ],
                    if (widget.kind == 'fnb-order') ...[
                      _row(
                        'Waiter',
                        value(widget.item['waiterName'], 'Unknown waiter'),
                      ),
                      _row(
                        'Table',
                        value(widget.item['tableNumber'], 'Not recorded'),
                      ),
                      _row(
                        'Order status',
                        value(widget.item['status'], 'OPEN'),
                      ),
                      _row('Order total', _money(widget.item['total'])),
                    ],
                    if (isCash)
                      _row('Expected cash', '₦${expected.toStringAsFixed(2)}'),
                    if (isSync) ...[
                      _row(
                        'Aggregate',
                        value(widget.item['aggregateType'], 'Financial record'),
                      ),
                      _row(
                        'Event',
                        value(
                          mapValue(widget.item['hotelEvent'])['eventType'],
                          'Financial event',
                        ),
                      ),
                      _row(
                        'Device',
                        value(
                          mapValue(widget.item['hotelEvent'])['deviceId'],
                          'Not recorded',
                        ),
                      ),
                      if (mapValue(widget.item['errorDetails'])['message'] !=
                          null)
                        _row(
                          'Issue',
                          value(
                            mapValue(widget.item['errorDetails'])['message'],
                          ),
                        ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if (isCash) ...[
                const Text(
                  'CASH RECONCILIATION',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: cashController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  style: const TextStyle(color: _text),
                  decoration: _inputDecoration('Actual declared cash', '0.00'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: reasonController,
                  minLines: 2,
                  maxLines: 3,
                  style: const TextStyle(color: _text),
                  decoration: _inputDecoration(
                    'Variance reason (required if different)',
                    'Explain any variance',
                  ),
                ),
                const SizedBox(height: 16),
                _actionButton(
                  label: widget.kind == 'pos-session'
                      ? 'Confirm & close session'
                      : 'Confirm & close shift',
                  color: Colors.indigoAccent,
                  onPressed: () {
                    final amount = double.tryParse(cashController.text.trim());
                    if (amount == null) return;
                    if (amount != expected &&
                        reasonController.text.trim().isEmpty) {
                      return;
                    }
                    Navigator.pop(
                      context,
                      '$amount|${reasonController.text.trim()}',
                    );
                  },
                ),
              ] else if (isSync) ...[
                const Text(
                  'CHOOSE RESOLUTION',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 9),
                _actionButton(
                  label: 'Reject edge event',
                  subtitle: 'Keep the authoritative PMS state.',
                  color: Colors.blueGrey,
                  onPressed: () => Navigator.pop(context, 'REJECT_EDGE_EVENT'),
                ),
                const SizedBox(height: 9),
                _actionButton(
                  label: 'Force sync event',
                  subtitle: 'Apply the remote financial event.',
                  color: Colors.redAccent,
                  onPressed: () => Navigator.pop(context, 'FORCE_EDGE_EVENT'),
                ),
              ] else ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.amberAccent.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(
                      color: Colors.amberAccent.withValues(alpha: .2),
                    ),
                  ),
                  child: const Text(
                    'Ask the responsible waiter to settle or void this order at the POS terminal. The night auditor should not void it without the required order investigation.',
                    style: TextStyle(color: _text, height: 1.4, fontSize: 12),
                  ),
                ),
                const SizedBox(height: 15),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: widget.onClose,
                    icon: const Icon(Icons.info_outline_rounded),
                    label: const Text('Close review'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.amberAccent,
                      side: BorderSide(
                        color: Colors.amberAccent.withValues(alpha: .45),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 5),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: widget.onClose,
                  child: const Text('Keep unresolved'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Map<String, dynamic> mapValue(dynamic input) =>
      input is Map ? Map<String, dynamic>.from(input) : <String, dynamic>{};

  String _money(dynamic amount) {
    final number = num.tryParse(amount?.toString() ?? '');
    return number == null ? '₦0.00' : '₦${number.toStringAsFixed(2)}';
  }

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: _text,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );

  InputDecoration _inputDecoration(String label, String hint) =>
      InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: const TextStyle(color: _muted),
        hintStyle: const TextStyle(color: Colors.white30),
        filled: true,
        fillColor: Colors.black.withValues(alpha: .16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: .1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: .1)),
        ),
      );

  Widget _actionButton({
    required String label,
    String? subtitle,
    required Color color,
    required VoidCallback onPressed,
  }) => SizedBox(
    width: double.infinity,
    child: FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 13),
      ),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
          if (subtitle != null)
            Text(
              subtitle,
              style: const TextStyle(fontSize: 10, color: Colors.white70),
            ),
        ],
      ),
    ),
  );
}

class RoomChargesReviewScreen extends StatelessWidget {
  final String businessDate;
  final List<Map<String, dynamic>> charges;
  final bool blocked;
  final Future<void> Function() onExecute;

  const RoomChargesReviewScreen({
    super.key,
    required this.businessDate,
    required this.charges,
    required this.blocked,
    required this.onExecute,
  });

  num _amount(Map<String, dynamic> item, String key, [String fallback = '0']) =>
      num.tryParse('${item[key] ?? item[fallback]}') ?? 0;

  @override
  Widget build(BuildContext context) {
    final gross = charges.fold<num>(
      0,
      (sum, item) => sum + _amount(item, 'grossAmount', 'amount'),
    );
    final discount = charges.fold<num>(
      0,
      (sum, item) =>
          sum + (num.tryParse('${item['discountAmount'] ?? 0}') ?? 0),
    );
    final net = charges.fold<num>(
      0,
      (sum, item) => sum + _amount(item, 'netAmount', 'amount'),
    );
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        foregroundColor: _text,
        elevation: 0,
        title: const Text(
          'ROOM CHARGE REVIEW',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [const Color(0xFF263B61), _card],
              ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: Colors.indigoAccent.withValues(alpha: .3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.fact_check_rounded,
                  color: Colors.indigoAccent,
                  size: 34,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Confirm nightly charges',
                  style: TextStyle(
                    color: _text,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  charges.isEmpty
                      ? 'Business date ${_displayDate(businessDate)}. No room charges are currently proposed.'
                      : 'Business date ${_displayDate(businessDate)}. Verify the proposal before anything is posted.',
                  style: const TextStyle(
                    color: _muted,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _totalCard('Gross', gross, Colors.white70)),
              const SizedBox(width: 8),
              Expanded(
                child: _totalCard('Discount', discount, Colors.amberAccent),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _totalCard('Net to post', net, Colors.greenAccent),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (blocked)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.redAccent.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: Colors.redAccent.withValues(alpha: .25),
                ),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.lock_outline_rounded, color: Colors.redAccent),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Execution is unavailable while blocking controls remain unresolved. Return to the wizard and resolve them first.',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              const Icon(Icons.list_alt_rounded, color: _gold, size: 17),
              const SizedBox(width: 8),
              Text(
                '${charges.length} charge${charges.length == 1 ? '' : 's'} proposed',
                style: const TextStyle(
                  color: _text,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (charges.isEmpty)
            _emptyChargesCard()
          else
            ...charges.map((item) => _chargeCard(item)),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
          child: FilledButton.icon(
            onPressed: blocked ? null : () => _confirmExecute(context),
            icon: const Icon(Icons.play_arrow_rounded),
            label: const Text('Confirm & Execute Night Audit'),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.green.shade700,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 15),
            ),
          ),
        ),
      ),
    );
  }

  Widget _emptyChargesCard() => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _card,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: Colors.white.withValues(alpha: .08)),
    ),
    child: const Row(
      children: [
        Icon(Icons.check_circle_outline_rounded, color: Colors.greenAccent),
        SizedBox(width: 10),
        Expanded(
          child: Text(
            'There are no room charges waiting to be posted for this audit.',
            style: TextStyle(color: _muted, fontSize: 12, height: 1.4),
          ),
        ),
      ],
    ),
  );

  Widget _totalCard(String label, num amount, Color color) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .06),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: color.withValues(alpha: .18)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: color.withValues(alpha: .8),
            fontSize: 9,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          '₦${amount.toStringAsFixed(0)}',
          style: TextStyle(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );

  Widget _chargeCard(Map<String, dynamic> item) {
    final guest = item['guestName'] ?? item['primaryGuestName'] ?? 'Guest';
    final room = formatRoomNumber(item['roomNumber'], fallback: '—');
    final amount = _amount(item, 'netAmount', 'amount');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.hotel_rounded,
                color: Colors.indigoAccent,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Room $room · $guest',
                  style: const TextStyle(
                    color: _text,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                '₦${amount.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Colors.greenAccent,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _pill(
                'Confirmation',
                item['confirmationNumber'] ?? 'Unavailable',
              ),
              _pill('Nights', item['nights'] ?? item['quantity'] ?? 1),
              _pill('Rate plan', item['ratePlanName'] ?? 'Standard'),
            ],
          ),
        ],
      ),
    );
    /*
    return Container(margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white.withValues(alpha: .08))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [const Icon(Icons.hotel_rounded, color: Colors.indigoAccent, size: 18), const SizedBox(width: 8), Expanded(child: Text('Room $room · $guest', style: const TextStyle(color: _text, fontWeight: FontWeight.w800))), Text('₦${amount.toStringAsFixed(2)}', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.w900))]), const SizedBox(height: 9), Wrap(spacing: 8, runSpacing: 6, children: [_pill('Confirmation', item['confirmationNumber'] ?? 'Unavailable'), _pill('Nights', item['nights'] ?? item['quantity'] ?? 1), _pill('Rate plan', item['ratePlanName'] ?? 'Standard')])])));
    */
  }

  Widget _pill(String label, dynamic value) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .05),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      '$label: $value',
      style: const TextStyle(color: _muted, fontSize: 10),
    ),
  );

  Future<void> _confirmExecute(BuildContext context) async {
    final net = charges.fold<num>(
      0,
      (sum, item) => sum + _amount(item, 'netAmount', 'amount'),
    );
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => Dialog(
        backgroundColor: _card,
        insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.greenAccent.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.verified_user_rounded,
                      color: Colors.greenAccent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Final execution check',
                      style: TextStyle(
                        color: _text,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(dialogContext, false),
                    icon: const Icon(Icons.close_rounded, color: _muted),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const Text(
                'You are about to close the audit for this business date.',
                style: TextStyle(color: _text, fontSize: 14, height: 1.4),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .04),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .08),
                  ),
                ),
                child: Column(
                  children: [
                    _confirmationRow(
                      'Business date',
                      _displayDate(businessDate),
                    ),
                    const SizedBox(height: 10),
                    _confirmationRow('Charges to post', '${charges.length}'),
                    const SizedBox(height: 10),
                    _confirmationRow(
                      'Net room revenue',
                      '₦${net.toStringAsFixed(2)}',
                      emphasize: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded, color: _gold, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Room charges will be posted and the property business date will advance. Confirm only after reviewing the details.',
                      style: TextStyle(
                        color: _muted,
                        fontSize: 11,
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(dialogContext, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _text,
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: .14),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                      ),
                      child: const Text('Go back'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => Navigator.pop(dialogContext, true),
                      icon: const Icon(Icons.play_arrow_rounded, size: 18),
                      label: const Text('Confirm & run'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.green.shade700,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
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
    if (confirmed == true && context.mounted) await onExecute();
  }

  Widget _confirmationRow(
    String label,
    String value, {
    bool emphasize = false,
  }) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(label, style: const TextStyle(color: _muted, fontSize: 12)),
      Text(
        value,
        style: TextStyle(
          color: emphasize ? Colors.greenAccent : _text,
          fontSize: 12,
          fontWeight: emphasize ? FontWeight.w900 : FontWeight.w700,
        ),
      ),
    ],
  );
}

class CashControlInstructionScreen extends StatelessWidget {
  final String title;
  final String kind;
  final List<Map<String, dynamic>> items;

  const CashControlInstructionScreen({
    super.key,
    required this.title,
    required this.kind,
    required this.items,
  });

  bool get isHandover => kind == 'cash-handover';

  @override
  Widget build(BuildContext context) {
    final color = Colors.amberAccent;
    final actionName = isHandover ? 'cash handover' : 'cash drop';
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        foregroundColor: _text,
        elevation: 0,
        title: const Text(
          'CASH CONTROL GUIDANCE',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [const Color(0xFF263047), _card],
              ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: color.withValues(alpha: .3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: .14),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Icon(
                        Icons.account_balance_wallet_rounded,
                        color: color,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          color: _text,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'This is a General Cashier follow-up, not a Night Audit blocker. The auditor should record the outstanding item and continue the audit after confirming the operational owner.',
                  style: const TextStyle(
                    color: _muted,
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _instructionSection(
            'WHAT THE GENERAL CASHIER SHOULD DO',
            isHandover
                ? [
                    'Confirm the cashier, drawer/location, amount, and handover reference.',
                    'Physically receive and count the cash with the handing-over cashier.',
                    'Accept the handover in the cash-management workflow and retain the audit evidence.',
                  ]
                : [
                    'Confirm the drop amount, location, cashier, and drop reference.',
                    'Verify the physical cash deposit with the General Cashier or safe custodian.',
                    'Record and reconcile the cash drop in the cash-management workflow.',
                  ],
            color,
          ),
          const SizedBox(height: 12),
          _instructionSection('AUDITOR ACTION', [
            'Confirm the General Cashier has been notified.',
            'Do not mark the warning as resolved without custody evidence.',
            'Return to the audit workflow and refresh the Cash Control step when the handoff is complete.',
          ], Colors.lightBlueAccent),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.greenAccent.withValues(alpha: .07),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: Colors.greenAccent.withValues(alpha: .2),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.check_circle_outline_rounded,
                  color: Colors.greenAccent,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'This warning does not prevent Night Audit from closing. Unverified payments or unreconciled cashier activity may still block close.',
                    style: const TextStyle(
                      color: _muted,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text(
            '${items.length} $actionName${items.length == 1 ? '' : 's'} currently pending',
            style: const TextStyle(
              color: _muted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _instructionSection(String heading, List<String> steps, Color color) =>
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: .2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              heading,
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 12),
            ...steps.asMap().entries.map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: .12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${entry.key + 1}',
                        style: TextStyle(
                          color: color,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        entry.value,
                        style: const TextStyle(
                          color: _text,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}

class NightAuditBlockerDetailsScreen extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  final Future<bool> Function(Map<String, dynamic> entry) onResolve;
  final Future<bool> Function(Map<String, dynamic> entry) onOpenModule;

  const NightAuditBlockerDetailsScreen({
    super.key,
    required this.title,
    required this.items,
    required this.onResolve,
    required this.onOpenModule,
  });

  @override
  State<NightAuditBlockerDetailsScreen> createState() =>
      _NightAuditBlockerDetailsScreenState();
}

class _NightAuditBlockerDetailsScreenState
    extends State<NightAuditBlockerDetailsScreen> {
  late final List<Map<String, dynamic>> remaining;
  late final int total;

  @override
  void initState() {
    super.initState();
    remaining = [...widget.items];
    total = widget.items.length;
  }

  String value(dynamic input, [String fallback = '—']) =>
      input == null || input.toString().trim().isEmpty
      ? fallback
      : input.toString();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        foregroundColor: _text,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'NIGHT AUDIT CONTROL',
              style: TextStyle(
                color: _gold,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.3,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              widget.title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 14),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: Colors.redAccent.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.redAccent.withValues(alpha: .25),
              ),
            ),
            child: Text(
              '${remaining.length} OPEN',
              style: const TextStyle(
                color: Colors.redAccent,
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: .6,
              ),
            ),
          ),
        ],
      ),
      body: remaining.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.check_circle_rounded,
                      color: Colors.greenAccent,
                      size: 64,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'All records resolved',
                      style: TextStyle(
                        color: _text,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'The Night Audit control has been refreshed successfully.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: _muted),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Return to audit'),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _intro(),
                const SizedBox(height: 14),
                ...remaining.asMap().entries.map(
                  (entry) => _recordCard(entry.key, entry.value),
                ),
              ],
            ),
    );
  }

  Widget _intro() => Container(
    padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [const Color(0xFF182A48), _card],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: _gold.withValues(alpha: .28)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: _gold.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.fact_check_rounded, color: _gold),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Resolution queue',
                    style: TextStyle(
                      color: _text,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 3),
                  Text(
                    'Clear every record before final sign-off',
                    style: TextStyle(color: _muted, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Control progress',
              style: TextStyle(
                color: _muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              '${total - remaining.length}/$total resolved',
              style: const TextStyle(
                color: Colors.amberAccent,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: total == 0 ? 1 : (total - remaining.length) / total,
            minHeight: 7,
            backgroundColor: Colors.white.withValues(alpha: .09),
            valueColor: const AlwaysStoppedAnimation<Color>(_gold),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Review the evidence on each record. Every resolution is logged against the Night Audit control trail.',
          style: TextStyle(color: _muted, fontSize: 12, height: 1.4),
        ),
      ],
    ),
  );

  Widget _recordCard(int index, Map<String, dynamic> entry) {
    final item = entry['item'] is Map
        ? Map<String, dynamic>.from(entry['item'] as Map)
        : <String, dynamic>{};
    final action = entry['action'];
    final color = action == 'info' ? Colors.orangeAccent : Colors.amberAccent;
    final key = entry['key']?.toString() ?? '';
    final isReservation = key == 'arrival' || key == 'departure';
    final guest = item['primaryGuest'] is Map
        ? Map<String, dynamic>.from(item['primaryGuest'] as Map)
        : <String, dynamic>{};
    final guestName =
        '${value(guest['firstName'], 'Guest')} ${value(guest['lastName'], '')}'
            .trim();
    final roomNumber = formatRoomNumber(
      item['roomNumber'] ??
          (item['reservationRooms'] is List &&
                  (item['reservationRooms'] as List).isNotEmpty
              ? ((item['reservationRooms'] as List).first is Map
                    ? ((item['reservationRooms'] as List).first['room'] is Map
                          ? (item['reservationRooms'] as List)
                                .first['room']['number']
                          : null)
                    : null)
              : null),
      fallback: '—',
    );
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: .25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${index + 1}',
                  style: TextStyle(color: color, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isReservation ? guestName : value(entry['title']),
                      style: const TextStyle(
                        color: _text,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      value(entry['title']),
                      style: TextStyle(
                        color: color,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (roomNumber != '—')
                _infoPill(Icons.hotel_rounded, 'Room $roomNumber'),
              if (item['confirmationNumber'] != null)
                _infoPill(
                  Icons.confirmation_number_outlined,
                  value(item['confirmationNumber']),
                ),
              if (item['checkIn'] != null)
                _infoPill(Icons.login_rounded, _shortDate(item['checkIn'])),
              if (item['checkOut'] != null)
                _infoPill(Icons.logout_rounded, _shortDate(item['checkOut'])),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: .07),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: color.withValues(alpha: .18)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'REASON FOR REVIEW',
                  style: TextStyle(
                    color: color.withValues(alpha: .9),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  value(entry['detail']),
                  style: const TextStyle(
                    color: _text,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          if (!isReservation && item['waiterName'] != null)
            _detail('Waiter', item['waiterName']),
          if (!isReservation && item['outletName'] != null)
            _detail('Outlet', item['outletName']),
          if (!isReservation &&
              (item['amount'] != null || item['total'] != null))
            _detail('Amount', '₦${value(item['amount'] ?? item['total'])}'),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () async {
                if (action == 'info') {
                  final resolved = await widget.onOpenModule(entry);
                  if (resolved && mounted) {
                    setState(() => remaining.removeAt(index));
                  }
                  return;
                }
                final resolved = await widget.onResolve(entry);
                if (resolved && mounted) {
                  setState(() => remaining.removeAt(index));
                }
              },
              icon: Icon(
                action == 'info'
                    ? Icons.open_in_new_rounded
                    : Icons.check_circle_outline_rounded,
              ),
              label: Text(
                action == 'info'
                    ? (entry['key'] == 'arrival' || entry['key'] == 'departure'
                          ? 'Resolve reservation'
                          : entry['key'] == 'room-discrepancy'
                          ? 'Resolve room'
                          : entry['key'] == 'cash-handover' ||
                                entry['key'] == 'cash-drop'
                          ? 'Resolve cash control'
                          : 'Open responsible module')
                    : 'Resolve this record',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoPill(IconData icon, String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .05),
      borderRadius: BorderRadius.circular(9),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: _muted),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            color: _muted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );

  String _shortDate(dynamic date) {
    final parsed = DateTime.tryParse(value(date));
    if (parsed == null) return value(date);
    return DateFormat('dd MMM').format(parsed.toLocal());
  }

  Widget _detail(String label, dynamic content) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Row(
      children: [
        Text('$label: ', style: const TextStyle(color: _muted, fontSize: 11)),
        Expanded(
          child: Text(
            value(content),
            style: const TextStyle(
              color: _text,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );
}

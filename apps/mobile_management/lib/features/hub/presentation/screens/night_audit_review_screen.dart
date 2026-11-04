import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/night_audit_repository.dart';
import '../../../finance/presentation/screens/finance_screen.dart';
import '../../../fnb/presentation/screens/fnb_screen.dart';
import '../providers/night_audit_provider.dart';
import 'hub_screen.dart';

const _bg = Color(0xFF070D1A);
const _card = Color(0xFF111D33);
const _gold = Color(0xFFD4A853);
const _text = Color(0xFFEEF2FF);
const _muted = Color(0xFF94A3B8);

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
        _header(businessDate),
        _stageRail(),
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
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
    child: Row(
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
  );

  Widget _stageRail() => SizedBox(
    height: 82,
    child: ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      scrollDirection: Axis.horizontal,
      itemCount: stages.length,
      separatorBuilder: (context, index) => const SizedBox(width: 8),
      itemBuilder: (_, index) {
        final active = index == step;
        final complete = index < step;
        return GestureDetector(
          onTap: () => setState(() => step = index),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 126,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: active ? const Color(0xFF21304B) : _card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: active
                    ? _gold.withValues(alpha: .65)
                    : Colors.white.withValues(alpha: .07),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  complete ? Icons.check_circle_rounded : stages[index].icon,
                  size: 18,
                  color: complete
                      ? Colors.greenAccent
                      : (active ? _gold : _muted),
                ),
                const Spacer(),
                Text(
                  '${index + 1}. ${stages[index].title}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: active ? _text : _muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );

  List<Map<String, dynamic>> _blockers(Map<String, dynamic> data) {
    final system = map(data['system']);
    final financial = map(data['financial']);
    final cash = map(data['cash']);
    final fnb = map(data['fnb']);
    final exceptions = map(fnb['exceptions']);
    final result = <Map<String, dynamic>>[];
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
      system['openPosOrders'],
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
      'Complimentary verification',
      'Approve or reject this complimentary record.',
      financial['unverifiedComplimentary'],
      'complimentary',
    );
    add(
      'bypass',
      'Check-in bypass review',
      'Verify or reject the bypass with an audit note.',
      financial['pendingCheckInBypasses'],
      'bypass',
    );
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
      exceptions['openOrders'],
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
      return _blockerList(
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
    return Column(
      children: [
        _summaryRow(
          'Arrivals',
          arrivals.length,
          Icons.login_rounded,
          Colors.lightBlueAccent,
        ),
        _summaryRow(
          'Departures',
          departures.length,
          Icons.logout_rounded,
          Colors.orangeAccent,
        ),
        _summaryRow(
          'Room discrepancies',
          rooms.length,
          Icons.cleaning_services_rounded,
          Colors.amberAccent,
        ),
        const SizedBox(height: 12),
        _notice(
          'Operational items are warnings unless the server marks them as blockers. Review them before sign-off, then continue to system controls.',
        ),
      ],
    );
  }

  Widget _financial(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> blockers,
  ) {
    final financial = map(data['financial']);
    final postings = list(financial['pendingNightAuditPostings']);
    return Column(
      children: [
        _summaryRow(
          'Room charges to post',
          postings.length,
          Icons.bed_rounded,
          Colors.greenAccent,
        ),
        _summaryRow(
          'Complimentary records',
          count(financial['unverifiedComplimentary']),
          Icons.card_giftcard_rounded,
          Colors.amberAccent,
        ),
        _summaryRow(
          'Pending approvals',
          count(financial['pendingDiscounts']),
          Icons.approval_rounded,
          Colors.orangeAccent,
        ),
        _summaryRow(
          'Check-in bypasses',
          count(financial['pendingCheckInBypasses']),
          Icons.verified_user_rounded,
          Colors.redAccent,
        ),
        const SizedBox(height: 12),
        _blockerList(
          blockers
              .where((b) => ['complimentary', 'bypass'].contains(b['key']))
              .toList(),
        ),
      ],
    );
  }

  Widget _cash(Map<String, dynamic> data, List<Map<String, dynamic>> blockers) {
    final cash = map(data['cash']);
    return Column(
      children: [
        _summaryRow(
          'Unverified transactions',
          count(cash['unverifiedTransactions']),
          Icons.receipt_long_rounded,
          Colors.redAccent,
        ),
        _summaryRow(
          'Cash handovers',
          count(cash['cashHandovers']),
          Icons.swap_horiz_rounded,
          Colors.amberAccent,
        ),
        _summaryRow(
          'Bank deposits',
          count(cash['bankDeposits']),
          Icons.account_balance_rounded,
          Colors.lightBlueAccent,
        ),
        const SizedBox(height: 12),
        _blockerList(blockers.where((b) => b['key'] == 'transaction').toList()),
      ],
    );
  }

  Widget _blockerList(List<Map<String, dynamic>> items) {
    if (items.isEmpty) {
      return _success('No blocking controls remain in this stage.');
    }
    return Column(children: items.map((entry) => _blockerCard(entry)).toList());
  }

  Widget _blockerCard(Map<String, dynamic> entry) {
    final item = map(entry['item']);
    final action = entry['action'];
    final label = text(
      item['orderNumber'] ?? item['reference'] ?? item['id'],
      'Record',
    );
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.redAccent.withValues(alpha: .22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Colors.amberAccent,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  text(entry['title']),
                  style: const TextStyle(
                    color: _text,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(label, style: const TextStyle(color: _muted, fontSize: 11)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            text(entry['detail']),
            style: const TextStyle(color: _muted, fontSize: 12, height: 1.35),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () =>
                  action == 'info' ? _openModule(entry) : _resolve(entry),
              icon: const Icon(Icons.arrow_forward_rounded, size: 16),
              label: Text(
                action == 'void'
                    ? 'Investigate / void'
                    : action == 'info'
                    ? 'Open module'
                    : 'Review',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openModule(Map<String, dynamic> entry) async {
    final key = entry['key'];
    final Widget screen;
    if (key == 'pos-order' || key == 'fnb-order' || key == 'pos-session') {
      screen = const FnbScreen();
    } else if (key == 'frontdesk') {
      screen = const FinanceScreen();
    } else {
      screen = const HubScreen();
    }
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    if (mounted) ref.invalidate(nightAuditWorkflowProvider(widget.propertyId));
  }

  Widget _signOff(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> blockers,
  ) {
    final summary = map(data['summary']);
    final serverBlockers = count(summary['blockers']);
    final blocked = serverBlockers > 0 || blockers.isNotEmpty;
    return Column(
      children: [
        Icon(
          blocked ? Icons.lock_outline_rounded : Icons.verified_rounded,
          size: 68,
          color: blocked ? Colors.orangeAccent : Colors.greenAccent,
        ),
        const SizedBox(height: 14),
        Text(
          blocked
              ? 'Controls still require attention'
              : 'Ready for final sign-off',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: _text,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          blocked
              ? '$serverBlockers server blocker(s) remain. Resolve them before execution.'
              : 'The audit will post room charges and roll the property business date forward.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: _muted, height: 1.45),
        ),
        const SizedBox(height: 20),
        _notice(
          'Execution is protected by the server permission and blocker checks. No charge is posted until you confirm the final step.',
        ),
      ],
    );
  }

  Widget _bottomBar(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> blockers,
  ) {
    final serverBlockers = count(map(data['summary'])['blockers']);
    final blocked = serverBlockers > 0 || blockers.isNotEmpty;
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
                    ? (blocked || confirming ? null : _execute)
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
                    : Text(step == 4 ? 'Confirm and run audit' : 'Continue'),
              ),
            ),
          ],
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

  Future<void> _resolve(Map<String, dynamic> entry) async {
    final item = map(entry['item']);
    final action = entry['action'];
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
    if (approved != true || !mounted) return;
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
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString()),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _summaryRow(String title, int value, IconData icon, Color color) =>
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: Colors.white.withValues(alpha: .07)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 13),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: _text,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              '$value',
              style: TextStyle(
                color: value > 0 ? color : _text,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
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

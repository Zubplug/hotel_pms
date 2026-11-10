import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../data/cashier_shifts_repository.dart';

// ─── Design Tokens ──────────────────────────────────────────────────────────
const _bg       = Color(0xFF060E1A);
const _surface  = Color(0xFF0D1B2E);
const _surfaceEl= Color(0xFF132338);
const _border   = Color(0xFF1E3352);
const _text     = Color(0xFFF0F5FF);
const _textSub  = Color(0xFF8FA3BF);
const _textDim  = Color(0xFF4D6480);
const _gold     = Color(0xFFD4A843);
const _teal     = Color(0xFF00C9C8);
const _emerald  = Color(0xFF10B981);
const _amber    = Color(0xFFF59E0B);
const _rose     = Color(0xFFF43F5E);
const _violet   = Color(0xFF8B5CF6);

const _varianceReasons = [
  ('CASH_COUNTING_ERROR', 'Cash counting error'),
  ('MISSING_RECEIPT', 'Missing receipt'),
  ('UNAUTHORIZED_PAYOUT', 'Unauthorized payout'),
  ('REFUND_ERROR', 'Refund error'),
  ('WRONG_CHANGE', 'Wrong change given'),
  ('CASH_DROP_ERROR', 'Cash drop error'),
  ('SYSTEM_ERROR', 'System error'),
  ('UNKNOWN', 'Unknown'),
  ('OTHER', 'Other'),
];

class CashierShiftsScreen extends ConsumerStatefulWidget {
  const CashierShiftsScreen({super.key});

  @override
  ConsumerState<CashierShiftsScreen> createState() =>
      _CashierShiftsScreenState();
}

class _CashierShiftsScreenState extends ConsumerState<CashierShiftsScreen> {
  @override
  Widget build(BuildContext context) {
    final shifts = ref.watch(cashierShiftsProvider);
    return Scaffold(
      backgroundColor: _bg,
      appBar: _buildAppBar(),
      body: shifts.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _gold, strokeWidth: 2.5)),
        error: (_, _) => _buildError(),
        data: (items) {
          final live = items.where((s) => s.controlStatus == 'OPEN').toList();
          final submitted = items.where((s) =>
              ['SUBMITTED', 'RETURNED'].contains(s.controlStatus)).toList();
          return RefreshIndicator(
            color: _gold,
            backgroundColor: _surfaceEl,
            strokeWidth: 2.5,
            onRefresh: () => ref.refresh(cashierShiftsProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              children: [
                _SummaryHero(items: items),
                const SizedBox(height: 16),
                if (live.isNotEmpty) ...[
                  const _ShiftSectionHeading(
                    title: 'LIVE SHIFTS',
                    subtitle: 'Currently open and receiving activity',
                    color: _emerald,
                    icon: Icons.radio_button_checked_rounded,
                  ),
                  const SizedBox(height: 10),
                  ...live.map((s) => _ShiftCard(shift: s, ref: ref)),
                  if (submitted.isNotEmpty) const SizedBox(height: 8),
                ],
                if (submitted.isNotEmpty) ...[
                  _AwaitingApprovalBanner(count: submitted.length),
                  const SizedBox(height: 12),
                  const _ShiftSectionHeading(
                    title: 'AWAITING APPROVAL',
                    subtitle: 'Submitted and returned shifts requiring follow-up',
                    color: _amber,
                    icon: Icons.pending_actions_rounded,
                  ),
                  const SizedBox(height: 10),
                  ...submitted.map((s) => _ShiftCard(shift: s, ref: ref)),
                ],
                if (live.isEmpty && submitted.isEmpty)
                  const _EmptyState()
              ],
            ),
          );
        },
      ),
    );
  }

  AppBar _buildAppBar() => AppBar(
        backgroundColor: _bg,
        foregroundColor: _text,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleSpacing: 20,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('SHIFT CONTROL',
              style: TextStyle(
                  color: _gold,
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.0)),
          const SizedBox(height: 2),
          const Text('Cash Accountability',
              style: TextStyle(color: _text, fontSize: 15, fontWeight: FontWeight.w800)),
        ]),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(cashierShiftsProvider),
            icon: const Icon(Icons.refresh_rounded, color: _textSub, size: 22),
          ),
          const SizedBox(width: 6),
        ],
      );

  Widget _buildError() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 68, height: 68,
            decoration: BoxDecoration(
                color: _rose.withValues(alpha: .1), shape: BoxShape.circle),
            child: const Icon(Icons.cloud_off_rounded, color: _rose, size: 32),
          ),
          const SizedBox(height: 16),
          const Text('Unable to load shifts',
              style: TextStyle(color: _text, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text('Pull down to retry',
              style: TextStyle(color: _textSub, fontSize: 12)),
        ]),
      );
}

// ─── Summary Hero ─────────────────────────────────────────────────────────────
class _SummaryHero extends StatelessWidget {
  final List<CashierShift> items;
  const _SummaryHero({required this.items});

  @override
  Widget build(BuildContext context) {
    final live     = items.where((s) => s.controlStatus == 'OPEN').length;
    final review   = items.where((s) =>
        ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'].contains(s.controlStatus)).length;
    final variance = items.where((s) => (s.variance ?? 0).abs() > .01).length;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF132742), Color(0xFF0D1E35), Color(0xFF091525)],
          stops: [0, 0.5, 1],
        ),
        border: Border.all(color: _gold.withValues(alpha: .25)),
        boxShadow: [
          BoxShadow(
              color: _gold.withValues(alpha: .06),
              blurRadius: 28,
              offset: const Offset(0, 10)),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: _gold.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _gold.withValues(alpha: .25)),
            ),
            child: const Icon(Icons.point_of_sale_rounded, color: _gold, size: 18),
          ),
          const SizedBox(width: 10),
          const Text('ACCOUNTABILITY OVERVIEW',
              style: TextStyle(color: _textSub, fontSize: 9.5,
                  fontWeight: FontWeight.w700, letterSpacing: 1.3)),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          _Metric(label: 'Live Tills', value: '$live', color: _teal,
              icon: Icons.radio_button_checked_rounded),
          _MetricDivider(),
          _Metric(label: 'To Review', value: '$review', color: _amber,
              icon: Icons.pending_actions_rounded),
          _MetricDivider(),
          _Metric(label: 'Variances', value: '$variance', color: _rose,
              icon: Icons.error_outline_rounded),
        ]),
      ]),
    );
  }
}

class _ShiftSectionHeading extends StatelessWidget {
  final String title;
  final String subtitle;
  final Color color;
  final IconData icon;

  const _ShiftSectionHeading({
    required this.title,
    required this.subtitle,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withValues(alpha: .25)),
            ),
            child: Icon(icon, color: color, size: 17),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.4,
                )),
                const SizedBox(height: 3),
                Text(subtitle, style: const TextStyle(
                  color: _textSub,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                )),
              ],
            ),
          ),
        ],
      );
}

class _AwaitingApprovalBanner extends StatelessWidget {
  final int count;
  const _AwaitingApprovalBanner({required this.count});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: _amber.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _amber.withValues(alpha: .28)),
        ),
        child: Row(
          children: [
            const Icon(Icons.schedule_rounded, color: _amber, size: 19),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '$count ${count == 1 ? 'shift needs' : 'shifts need'} review',
                style: const TextStyle(
                  color: _text,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const Icon(Icons.arrow_downward_rounded, color: _amber, size: 17),
          ],
        ),
      );
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _Metric({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, color: color, size: 11),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(color: _textDim, fontSize: 9.5,
            fontWeight: FontWeight.w600)),
      ]),
      const SizedBox(height: 6),
      Text(value,
          style: TextStyle(color: color, fontSize: 26,
              fontWeight: FontWeight.w900, letterSpacing: -1)),
    ]),
  );
}

class _MetricDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
      width: 1, height: 42,
      margin: const EdgeInsets.symmetric(horizontal: 14),
      color: _border);
}

// ─── Shift Card ───────────────────────────────────────────────────────────────
class _ShiftCard extends StatefulWidget {
  final CashierShift shift;
  final WidgetRef ref;
  const _ShiftCard({required this.shift, required this.ref});

  @override
  State<_ShiftCard> createState() => _ShiftCardState();
}

class _ShiftCardState extends State<_ShiftCard> {
  bool _pressed = false;

  Color _statusColor(String s) {
    switch (s) {
      case 'RETURNED':    return _rose;
      case 'UNDER_REVIEW': return _violet;
      case 'SUBMITTED':   return _amber;
      case 'OPEN':        return _emerald;
      case 'APPROVED':
      case 'APPROVED_WITH_VARIANCE':
      case 'RECONCILED':  return _teal;
      default:            return _gold;
    }
  }

  String _statusLabel(String s) => s
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .map((p) => p.isEmpty ? p : '${p[0].toUpperCase()}${p.substring(1)}')
      .join(' ');

  String _time(DateTime? d) => d == null
      ? '—'
      : DateFormat('EEE, d MMM · HH:mm').format(d.toLocal());

  @override
  Widget build(BuildContext context) {
    final shift   = widget.shift;
    final c       = _statusColor(shift.controlStatus);
    final variance = shift.variance ?? 0;
    final hasVar  = variance.abs() > .01;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _pressed ? _surfaceEl : _surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: _pressed ? c.withValues(alpha: .4) : _border,
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Header row
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: c.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                shift.type == 'POS'
                    ? Icons.point_of_sale_rounded
                    : Icons.desk_rounded,
                color: c, size: 18,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(shift.label,
                style: const TextStyle(color: _text, fontWeight: FontWeight.w700,
                    fontSize: 13))),
            _Pill(label: _statusLabel(shift.controlStatus), color: c),
          ]),
          const SizedBox(height: 10),
          Text(
            '${shift.type == 'POS' ? 'POS Till' : 'Front Desk'} · ${shift.operator}',
            style: const TextStyle(color: _textSub, fontSize: 11),
          ),
          const SizedBox(height: 14),
          // Amount row
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _border),
            ),
            child: Row(children: [
              _Amount(label: 'Expected',  value: shift.expected),
              _AmountDivider(),
              _Amount(label: 'Declared',  value: shift.declared),
              _AmountDivider(),
              _Amount(
                label: 'Variance',
                value: hasVar ? variance : variance,
                color: hasVar ? _rose : _emerald,
              ),
            ]),
          ),
          const SizedBox(height: 12),
          // Footer
          Row(children: [
            Icon(Icons.access_time_rounded, color: _textDim, size: 12),
            const SizedBox(width: 4),
            Expanded(child: Text(
              _time(widget.shift.updatedAt ?? widget.shift.openedAt),
              style: const TextStyle(color: _textDim, fontSize: 11),
            )),
            _shiftAction(shift),
          ]),
        ]),
      ),
    );
  }

  Widget _shiftAction(CashierShift shift) {
    if (shift.controlStatus == 'SUBMITTED') {
      return _ActionChip(
        label: 'Start Review',
        color: _violet,
        onTap: () => _startReview(shift),
      );
    }
    if (shift.controlStatus == 'UNDER_REVIEW') {
      return _ActionChip(
        label: 'Review Shift',
        color: _teal,
        onTap: () => _openReview(shift),
      );
    }
    if (shift.controlStatus == 'RETURNED') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: _rose.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text('Awaiting correction',
            style: TextStyle(color: _rose, fontSize: 10, fontWeight: FontWeight.w700)),
      );
    }
    if (shift.controlStatus == 'OPEN') {
      return Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 6, height: 6,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: _emerald)),
        const SizedBox(width: 4),
        const Text('Live', style: TextStyle(color: _emerald, fontSize: 11,
            fontWeight: FontWeight.w700)),
      ]);
    }
    return const SizedBox.shrink();
  }

  Future<void> _startReview(CashierShift shift) async {
    // The web review workspace opens directly from SUBMITTED. The review
    // decision itself is the state transition; opening the screen must not
    // mutate the shift to UNDER_REVIEW.
    await _openReview(shift);
  }

  Future<void> _openReview(CashierShift shift) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => CashierShiftReviewScreen(shift: shift)));
    widget.ref.invalidate(cashierShiftsProvider);
  }
}

class CashierShiftReviewScreen extends ConsumerStatefulWidget {
  final CashierShift shift;
  const CashierShiftReviewScreen({super.key, required this.shift});
  @override ConsumerState<CashierShiftReviewScreen> createState() => _CashierShiftReviewScreenState();
}

class _CashierShiftReviewScreenState extends ConsumerState<CashierShiftReviewScreen> {
  late final TextEditingController _notes;
  String? _reason;
  late String _decision;
  bool _saving = false;
  CashierShift get shift => widget.shift;
  double get variance => shift.variance ?? 0;
  bool get hasVariance => variance.abs() > .01;
  bool get requiresNotes => _decision != 'APPROVE';

  @override void initState() {
    super.initState();
    _notes = TextEditingController();
    _decision = hasVariance ? 'APPROVE_WITH_VARIANCE' : 'APPROVE';
  }
  @override void dispose() { _notes.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _bg,
    appBar: AppBar(backgroundColor: _bg, foregroundColor: _text, surfaceTintColor: Colors.transparent, title: const Text('Shift review', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
    body: SafeArea(child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
      _ReviewPanel(title: shift.label, icon: Icons.rate_review_rounded, color: _violet, child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${shift.type == 'POS' ? 'POS till' : 'Front desk'} · ${shift.operator}', style: const TextStyle(color: _textSub, fontSize: 12)),
          const SizedBox(height: 5), Text(shift.businessDate == null ? 'Business date unavailable' : DateFormat('EEE, d MMM yyyy').format(shift.businessDate!.toLocal()), style: const TextStyle(color: _textDim, fontSize: 11)),
        ])), _Pill(label: _label(shift.controlStatus), color: _violet),
      ])),
      const SizedBox(height: 12),
      _ReviewPanel(title: 'CASH ACCOUNTABILITY', icon: Icons.account_balance_wallet_rounded, child: Column(children: [
        Row(children: [_ReviewStat('Opening float', shift.openingFloat, _text), _ReviewStat('Expected', shift.expected, _teal)]),
        const SizedBox(height: 14), Row(children: [_ReviewStat('Declared', shift.declared, _text), _ReviewStat('Variance', variance, hasVariance ? _amber : _emerald)]),
      ])),
      const SizedBox(height: 12),
      _collectionAnalysis(),
      const SizedBox(height: 12),
      _ReviewPanel(title: 'REVIEW DECISION', icon: Icons.fact_check_rounded, child: Column(children: [
        _reviewChoice('APPROVE', 'Approve', 'Balanced shift with no variance.', _emerald, !hasVariance),
        const SizedBox(height: 8), _reviewChoice('APPROVE_WITH_VARIANCE', 'Approve with variance', 'Accept and document a shortage or overage.', _amber, hasVariance),
        const SizedBox(height: 8), _reviewChoice('RETURN', 'Return for correction', 'Send the shift back to the operator.', _rose, true),
      ])),
      if (_decision == 'APPROVE_WITH_VARIANCE') ...[
        const SizedBox(height: 12),
        _ReviewPanel(title: 'VARIANCE REASON · REQUIRED', icon: Icons.warning_amber_rounded, color: _amber, child: DropdownButtonFormField<String>(initialValue: _reason, dropdownColor: _surfaceEl, style: const TextStyle(color: _text, fontSize: 13), decoration: _decoration('Select the root cause'), items: _varianceReasons.map((r) => DropdownMenuItem(value: r.$1, child: Text(r.$2))).toList(), onChanged: (v) => setState(() => _reason = v))),
      ],
      const SizedBox(height: 12),
      _ReviewPanel(title: requiresNotes ? 'INVESTIGATION NOTES · REQUIRED' : 'INVESTIGATION NOTES · OPTIONAL', icon: Icons.notes_rounded, color: requiresNotes ? _amber : _textSub, child: TextField(controller: _notes, maxLines: 4, maxLength: 1000, style: const TextStyle(color: _text, fontSize: 13), decoration: _decoration(requiresNotes ? 'Record what was checked (minimum 10 characters)' : 'Add audit context'))),
      const SizedBox(height: 16), SizedBox(height: 52, child: ElevatedButton.icon(onPressed: _saving ? null : _submit, icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.shield_rounded), label: Text(_saving ? 'Processing…' : _decision == 'RETURN' ? 'Return for correction' : 'Submit review'), style: ElevatedButton.styleFrom(backgroundColor: _decision == 'RETURN' ? _rose : _teal, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))))),
    ])),
  );

  Widget _collectionAnalysis() {
    final total = shift.paymentTotals.values.fold<double>(0, (sum, amount) => sum + amount);
    final cash = shift.paymentTotals.entries.where((entry) => entry.key.toUpperCase() == 'CASH').fold<double>(0, (sum, entry) => sum + entry.value);
    final nonCash = total - cash;
    return _ReviewPanel(
      title: 'COLLECTION ANALYSIS',
      icon: Icons.bar_chart_rounded,
      color: _teal,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          _ReviewStat('Receipts', total, _text),
          _ReviewStat('Transactions', shift.paymentCount.toDouble(), _teal),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          _ReviewStat('Cash collected', cash, _emerald),
          _ReviewStat('Non-cash', nonCash, _violet),
        ]),
        const SizedBox(height: 16),
        const Text('BY PAYMENT METHOD', style: TextStyle(color: _textDim, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
        const SizedBox(height: 8),
        if (shift.paymentTotals.isEmpty)
          const Text('No completed collections recorded.', style: TextStyle(color: _textSub, fontSize: 11))
        else
          ...shift.paymentTotals.entries.map((entry) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Expanded(child: Text(entry.key.replaceAll('_', ' '), style: const TextStyle(color: _textSub, fontSize: 11))),
              Text(_money(entry.value), style: const TextStyle(color: _text, fontSize: 11, fontWeight: FontWeight.w800)),
            ]),
          )),
        if (shift.cashMovements.isNotEmpty) ...[
          const Divider(color: _border, height: 18),
          const Text('CASH MOVEMENTS', style: TextStyle(color: _textDim, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
          const SizedBox(height: 8),
          ...shift.cashMovements.entries.where((entry) => entry.value != 0).map((entry) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(children: [Expanded(child: Text(entry.key.replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}').trim(), style: const TextStyle(color: _textSub, fontSize: 11))), Text(_money(entry.value), style: const TextStyle(color: _text, fontSize: 11, fontWeight: FontWeight.w700))]))),
        ],
      ]),
    );
  }

  Widget _reviewChoice(String value, String title, String description, Color color, bool enabled) {
    return InkWell(
      onTap: enabled ? () => setState(() => _decision = value) : null,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _decision == value ? color.withValues(alpha: .12) : _bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _decision == value ? color : _border),
        ),
        child: Row(children: [
          Icon(_decision == value ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: enabled ? color : _textDim, size: 19),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(color: enabled ? _text : _textDim, fontWeight: FontWeight.w700, fontSize: 12)),
            const SizedBox(height: 3),
            Text(enabled ? description : value == 'APPROVE' ? 'Only available with no variance.' : 'Only available when a variance exists.', style: const TextStyle(color: _textSub, fontSize: 11)),
          ])),
        ]),
      ),
    );
  }
  Future<void> _submit() async {
    if (_decision == 'APPROVE_WITH_VARIANCE' && _reason == null) return _message('Select a variance reason before submitting.');
    if (requiresNotes && _notes.text.trim().length < 10) return _message('Add at least 10 characters to the required investigation notes.');
    setState(() => _saving = true);
    try {
      await ref.read(cashierShiftsRepositoryProvider).act(shift, _decision, notes: _notes.text.trim(), reasonCode: _reason);
      if (!mounted) return;
      await _showReviewSuccess();
      if (mounted) Navigator.pop(context);
    } catch (error) { if (mounted) _message('Unable to submit review: $error'); }
    finally { if (mounted) setState(() => _saving = false); }
  }
  void _message(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _showReviewSuccess() async {
    final returned = _decision == 'RETURN';
    final withVariance = _decision == 'APPROVE_WITH_VARIANCE';
    final color = returned ? _rose : withVariance ? _amber : _emerald;
    final title = returned ? 'Sent for correction' : withVariance ? 'Approved with variance' : 'Shift approved';
    final description = returned
        ? 'The shift has been returned to the operator with your review notes.'
        : withVariance
            ? 'The variance and its supporting reason have been recorded in the audit trail.'
            : 'The cashier shift was reconciled successfully with no variance.';

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24),
        child: Container(
          padding: const EdgeInsets.fromLTRB(22, 26, 22, 20),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: color.withValues(alpha: .35)),
            boxShadow: [BoxShadow(color: color.withValues(alpha: .15), blurRadius: 30, offset: const Offset(0, 14))],
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(color: color.withValues(alpha: .12), shape: BoxShape.circle, border: Border.all(color: color.withValues(alpha: .35))),
              child: Icon(returned ? Icons.undo_rounded : Icons.check_rounded, color: color, size: 34),
            ),
            const SizedBox(height: 18),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(color: _text, fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(shift.label, textAlign: TextAlign.center, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Text(description, textAlign: TextAlign.center, style: const TextStyle(color: _textSub, fontSize: 12, height: 1.45)),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
              child: Row(children: [
                Icon(Icons.verified_user_outlined, color: color, size: 17),
                const SizedBox(width: 8),
                const Expanded(child: Text('Recorded in the shift audit trail', style: TextStyle(color: _textSub, fontSize: 11, fontWeight: FontWeight.w600))),
              ]),
            ),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 46, child: ElevatedButton(onPressed: () => Navigator.pop(context), style: ElevatedButton.styleFrom(backgroundColor: color, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))), child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w800)))),
          ]),
        ),
      ),
    );
  }

  String _label(String value) => value.replaceAll('_', ' ').toLowerCase().split(' ').map((p) => p.isEmpty ? p : '${p[0].toUpperCase()}${p.substring(1)}').join(' ');
  String _money(double amount) => NumberFormat('#,##0.00').format(amount);
  InputDecoration _decoration(String hint) => InputDecoration(hintText: hint, hintStyle: const TextStyle(color: _textDim, fontSize: 12), filled: true, fillColor: _bg, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _border)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _border)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _gold, width: 1.5)));
}

class _ReviewPanel extends StatelessWidget { final String title; final IconData icon; final Widget child; final Color color; const _ReviewPanel({required this.title, required this.icon, required this.child, this.color = _textSub}); @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: _border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Icon(icon, color: color, size: 16), const SizedBox(width: 8), Text(title, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.1))]), const SizedBox(height: 14), child])); }
class _ReviewStat extends StatelessWidget { final String label; final double? value; final Color color; const _ReviewStat(this.label, this.value, this.color); @override Widget build(BuildContext context) => Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: _textDim, fontSize: 10)), const SizedBox(height: 5), Text(value == null ? 'Not declared' : NumberFormat('#,##0.00').format(value), style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w800))])); }

// ─── Review Sheet ─────────────────────────────────────────────────────────────
class _ReviewSheet extends StatelessWidget {
  final CashierShift shift;
  final TextEditingController notes;
  final TextEditingController reason;
  const _ReviewSheet({
    required this.shift,
    required this.notes,
    required this.reason,
  });

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00');
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 24, 20, MediaQuery.of(context).viewInsets.bottom + 28),
      child: Column(mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Handle bar
        Center(child: Container(
          width: 36, height: 4,
          margin: const EdgeInsets.only(bottom: 20),
          decoration: BoxDecoration(
              color: _border, borderRadius: BorderRadius.circular(2)),
        )),
        Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: _violet.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(Icons.rate_review_rounded, color: _violet, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Review ${shift.label}',
                style: const TextStyle(color: _text, fontSize: 16,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(
              'Expected ${fmt.format(shift.expected)} · '
              'Declared ${shift.declared == null ? '—' : fmt.format(shift.declared!)}',
              style: const TextStyle(color: _textSub, fontSize: 11),
            ),
          ])),
        ]),
        const SizedBox(height: 20),
        _StyledField(controller: reason,
            label: 'Variance reason code (if applicable)'),
        const SizedBox(height: 12),
        _StyledField(controller: notes, label: 'Review notes'),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(child: _SheetBtn(
            label: 'Return',
            color: _rose,
            filled: false,
            onTap: () => Navigator.pop(context, 'RETURN'),
          )),
          const SizedBox(width: 8),
          Expanded(child: _SheetBtn(
            label: 'Approve Variance',
            color: _amber,
            filled: false,
            onTap: () => Navigator.pop(context, 'APPROVE_WITH_VARIANCE'),
          )),
          const SizedBox(width: 8),
          Expanded(child: _SheetBtn(
            label: 'Approve',
            color: _emerald,
            filled: true,
            onTap: () => Navigator.pop(context, 'APPROVE'),
          )),
        ]),
      ]),
    );
  }
}

class _StyledField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  const _StyledField({required this.controller, required this.label});

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    style: const TextStyle(color: _text, fontSize: 13),
    decoration: InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: _textSub, fontSize: 12),
      filled: true,
      fillColor: _bg,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _gold, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    ),
  );
}

class _SheetBtn extends StatelessWidget {
  final String label;
  final Color color;
  final bool filled;
  final VoidCallback onTap;
  const _SheetBtn({
    required this.label,
    required this.color,
    required this.filled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 44,
    child: ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: filled ? color : color.withValues(alpha: .1),
        foregroundColor: filled ? Colors.white : color,
        elevation: 0,
        padding: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: filled ? BorderSide.none : BorderSide(color: color.withValues(alpha: .4)),
        ),
      ),
      child: Text(label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
    ),
  );
}

// ─── Shared Widgets ───────────────────────────────────────────────────────────
class _Pill extends StatelessWidget {
  final String label;
  final Color color;
  const _Pill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withValues(alpha: .35)),
    ),
    child: Text(label,
        style: TextStyle(color: color, fontSize: 9.5, fontWeight: FontWeight.w800)),
  );
}

class _Amount extends StatelessWidget {
  final String label;
  final double? value;
  final Color? color;
  const _Amount({required this.label, this.value, this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(color: _textDim, fontSize: 9.5,
          fontWeight: FontWeight.w600)),
      const SizedBox(height: 4),
      Text(
        value == null ? '—' : NumberFormat('#,##0.00').format(value),
        style: TextStyle(
          color: color ?? _text,
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    ]),
  );
}

class _AmountDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
      width: 1, height: 32,
      margin: const EdgeInsets.symmetric(horizontal: 10),
      color: _border);
}

class _ActionChip extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionChip({required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: .4)),
      ),
      child: Text(label,
          style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    ),
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(32),
    decoration: BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: _border),
    ),
    child: Column(children: [
      Container(
        width: 60, height: 60,
        decoration: BoxDecoration(
          color: _emerald.withValues(alpha: .1),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check_circle_outline_rounded,
            color: _emerald, size: 32),
      ),
      const SizedBox(height: 14),
      const Text('No shifts in this view',
          style: TextStyle(color: _text, fontWeight: FontWeight.w700, fontSize: 14)),
      const SizedBox(height: 6),
      const Text('Live tills and submitted sessions will appear here.',
          textAlign: TextAlign.center,
          style: TextStyle(color: _textSub, fontSize: 12)),
    ]),
  );
}

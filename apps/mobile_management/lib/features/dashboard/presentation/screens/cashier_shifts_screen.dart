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
        onTap: () => _act(shift, 'START_REVIEW'),
      );
    }
    if (shift.controlStatus == 'UNDER_REVIEW') {
      return _ActionChip(
        label: 'Review Shift',
        color: _teal,
        onTap: () => _review(shift),
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

  Future<void> _act(CashierShift shift, String action) async {
    await widget.ref.read(cashierShiftsRepositoryProvider).act(shift, action);
    widget.ref.invalidate(cashierShiftsProvider);
  }

  Future<void> _review(CashierShift shift) async {
    final notes  = TextEditingController();
    final reason = TextEditingController();
    final result = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: _surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _ReviewSheet(shift: shift, notes: notes, reason: reason),
    );
    if (result == null) return;
    await widget.ref
        .read(cashierShiftsRepositoryProvider)
        .act(shift, result, notes: notes.text, reasonCode: reason.text);
    widget.ref.invalidate(cashierShiftsProvider);
  }
}

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

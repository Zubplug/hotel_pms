import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../data/cashier_shifts_repository.dart';

const _bg = Color(0xFF07111F),
    _panel = Color(0xFF101C30),
    _line = Color(0xFF263A59),
    _text = Color(0xFFF4F7FC),
    _muted = Color(0xFF91A2BB),
    _gold = Color(0xFFD8AD52),
    _green = Color(0xFF42D392),
    _amber = Color(0xFFF3B35B),
    _red = Color(0xFFF2767B),
    _cyan = Color(0xFF55C7E8);

class CashierShiftsScreen extends ConsumerStatefulWidget {
  const CashierShiftsScreen({super.key});
  @override
  ConsumerState<CashierShiftsScreen> createState() =>
      _CashierShiftsScreenState();
}

class _CashierShiftsScreenState extends ConsumerState<CashierShiftsScreen> {
  String filter = 'ALL';
  @override
  Widget build(BuildContext context) {
    final shifts = ref.watch(cashierShiftsProvider);
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        foregroundColor: _text,
        title: const Text(
          'Shift control',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(cashierShiftsProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: shifts.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _gold)),
        error: (e, _) => const Center(
          child: Text('Unable to load shifts', style: TextStyle(color: _muted)),
        ),
        data: (items) {
          final visible = items.where((s) {
            if (filter == 'LIVE') return s.controlStatus == 'OPEN';
            if (filter == 'REVIEW')
              return [
                'SUBMITTED',
                'UNDER_REVIEW',
                'RETURNED',
              ].contains(s.controlStatus);
            if (filter == 'APPROVED')
              return [
                'APPROVED',
                'APPROVED_WITH_VARIANCE',
                'RECONCILED',
              ].contains(s.controlStatus);
            return true;
          }).toList();
          return RefreshIndicator(
            color: _gold,
            onRefresh: () => ref.refresh(cashierShiftsProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _hero(items),
                const SizedBox(height: 18),
                _filters(),
                const SizedBox(height: 14),
                if (visible.isEmpty)
                  const _EmptyState()
                else
                  ...visible.map(_card),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _hero(List<CashierShift> items) {
    final live = items.where((s) => s.controlStatus == 'OPEN').length;
    final review = items
        .where(
          (s) => [
            'SUBMITTED',
            'UNDER_REVIEW',
            'RETURNED',
          ].contains(s.controlStatus),
        )
        .length;
    final variance = items.where((s) => (s.variance ?? 0).abs() > .01).length;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Cash accountability',
            style: TextStyle(
              color: _muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Every till, one controlled view.',
            style: TextStyle(
              color: _text,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _metric('$live', 'Live', _cyan),
              _metric('$review', 'To review', _amber),
              _metric('$variance', 'Variances', _red),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metric(String value, String label, Color color) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 21,
            fontWeight: FontWeight.w900,
          ),
        ),
        Text(label, style: const TextStyle(color: _muted, fontSize: 11)),
      ],
    ),
  );
  Widget _filters() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: ['ALL', 'LIVE', 'REVIEW', 'APPROVED'].map((value) {
          final active = value == filter;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(
                value == 'ALL'
                    ? 'All shifts'
                    : value[0] + value.substring(1).toLowerCase(),
              ),
              selected: active,
              onSelected: (_) => setState(() => filter = value),
              selectedColor: _gold.withValues(alpha: .2),
              backgroundColor: _panel,
              side: BorderSide(color: active ? _gold : _line),
              labelStyle: TextStyle(
                color: active ? _gold : _muted,
                fontWeight: FontWeight.w700,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _card(CashierShift shift) {
    final color = shift.controlStatus == 'RETURNED'
        ? _red
        : shift.controlStatus == 'UNDER_REVIEW'
        ? _cyan
        : shift.controlStatus == 'SUBMITTED'
        ? _amber
        : shift.controlStatus == 'OPEN'
        ? _green
        : _gold;
    final variance = shift.variance ?? 0;
    Widget action = const SizedBox.shrink();
    if (shift.controlStatus == 'SUBMITTED')
      action = _action(shift, 'Start review', 'START_REVIEW', _cyan);
    if (shift.controlStatus == 'UNDER_REVIEW') action = _reviewActions(shift);
    if (shift.controlStatus == 'RETURNED')
      action = const Text(
        'Awaiting cashier correction',
        style: TextStyle(
          color: _red,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      );
    if (shift.controlStatus == 'OPEN')
      action = const Text(
        'Live · not submitted',
        style: TextStyle(
          color: _green,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      );
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                shift.type == 'POS'
                    ? Icons.point_of_sale_rounded
                    : Icons.desk_rounded,
                color: color,
                size: 19,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  shift.label,
                  style: const TextStyle(
                    color: _text,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _pill(_label(shift.controlStatus), color),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '${shift.type == 'POS' ? 'POS till' : 'Front Desk'} · ${shift.operator}',
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
          const SizedBox(height: 13),
          Row(
            children: [
              _amount('Expected', shift.expected),
              _amount('Declared', shift.declared),
              _amount(
                'Variance',
                variance,
                color: variance.abs() > .01 ? _red : _green,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  _time(shift.updatedAt ?? shift.openedAt),
                  style: const TextStyle(color: _muted, fontSize: 11),
                ),
              ),
              action,
            ],
          ),
        ],
      ),
    );
  }

  Widget _reviewActions(CashierShift shift) => TextButton(
    onPressed: () => _review(shift),
    child: const Text(
      'Review shift',
      style: TextStyle(color: _cyan, fontWeight: FontWeight.w800),
    ),
  );
  Widget _action(
    CashierShift shift,
    String label,
    String action,
    Color color,
  ) => TextButton(
    onPressed: () async {
      await ref.read(cashierShiftsRepositoryProvider).act(shift, action);
      ref.invalidate(cashierShiftsProvider);
    },
    child: Text(
      label,
      style: TextStyle(color: color, fontWeight: FontWeight.w800),
    ),
  );
  Widget _amount(String label, double? amount, {Color? color}) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: _muted, fontSize: 10)),
        const SizedBox(height: 3),
        Text(
          amount == null ? '—' : NumberFormat('#,##0.00').format(amount),
          style: TextStyle(
            color: color ?? _text,
            fontSize: 13,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
  Widget _pill(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withValues(alpha: .35)),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w900),
    ),
  );
  String _label(String value) => value
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .map((s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}')
      .join(' ');
  String _time(DateTime? value) => value == null
      ? 'Time unavailable'
      : DateFormat('EEE, d MMM · HH:mm').format(value.toLocal());
  Future<void> _review(CashierShift shift) async {
    final notes = TextEditingController();
    final reason = TextEditingController();
    final result = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: _panel,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.fromLTRB(
          18,
          20,
          18,
          MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Review ${shift.label}',
              style: const TextStyle(
                color: _text,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Expected ${NumberFormat('#,##0.00').format(shift.expected)} · Declared ${shift.declared == null ? '—' : NumberFormat('#,##0.00').format(shift.declared)}',
              style: const TextStyle(color: _muted),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reason,
              style: const TextStyle(color: _text),
              decoration: const InputDecoration(
                labelText: 'Variance reason code (if applicable)',
                labelStyle: TextStyle(color: _muted),
              ),
            ),
            TextField(
              controller: notes,
              style: const TextStyle(color: _text),
              decoration: const InputDecoration(
                labelText: 'Review notes',
                labelStyle: TextStyle(color: _muted),
              ),
            ),
            const SizedBox(height: 15),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, 'RETURN'),
                    child: const Text('Return'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () =>
                        Navigator.pop(context, 'APPROVE_WITH_VARIANCE'),
                    child: const Text('Approve variance'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context, 'APPROVE'),
                    child: const Text('Approve'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (result == null) return;
    await ref
        .read(cashierShiftsRepositoryProvider)
        .act(shift, result, notes: notes.text, reasonCode: reason.text);
    ref.invalidate(cashierShiftsProvider);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(28),
    decoration: BoxDecoration(
      color: _panel,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _line),
    ),
    child: const Column(
      children: [
        Icon(Icons.check_circle_outline_rounded, color: _green, size: 38),
        SizedBox(height: 10),
        Text(
          'No shifts in this view',
          style: TextStyle(color: _text, fontWeight: FontWeight.w800),
        ),
        SizedBox(height: 4),
        Text(
          'Live tills and submitted shift packets will appear here.',
          textAlign: TextAlign.center,
          style: TextStyle(color: _muted, fontSize: 12),
        ),
      ],
    ),
  );
}

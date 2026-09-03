import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/finance_provider.dart';
import '../models/finance_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _navy = Color(0xFF0F172A);
const _surface = Color(0xFF1E293B);
const _border = Color(0xFF2D3E52);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);
const _gold = Color(0xFFD4AF37);
const _green = Color(0xFF22C55E);
const _red = Color(0xFFEF4444);
const _orange = Color(0xFFF97316);
const _blue = Color(0xFF3B82F6);
const _purple = Color(0xFFA855F7);

// ─── Screen ───────────────────────────────────────────────────────────────────
class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});

  @override
  ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen> {
  final _fmt = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
  final _dateFmt = DateFormat('dd MMM yyyy');
  final _timeFmt = DateFormat('dd MMM • HH:mm');

  String _fmtAmount(double v) {
    if (v >= 1000000) return '₦${(v / 1000000).toStringAsFixed(2)}M';
    if (v >= 1000) return '₦${(v / 1000).toStringAsFixed(1)}K';
    return _fmt.format(v);
  }

  String _fmtDate(String s) {
    if (s.isEmpty) return '—';
    try { return _dateFmt.format(DateTime.parse(s)); } catch (_) { return s; }
  }

  String _fmtDateTime(String? s) {
    if (s == null || s.isEmpty) return '—';
    try { return _timeFmt.format(DateTime.parse(s).toLocal()); } catch (_) { return s; }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(financeDataProvider);
    final period = ref.watch(financePeriodProvider);
    final periodSuffix = period == 'TODAY' ? 'TODAY' : period;

    return Scaffold(
      backgroundColor: _navy,
      appBar: _buildAppBar(state.value),
      body: state.when(
        loading: () => _buildSkeleton(),
        error: (e, _) => _buildError(() => ref.refresh(financeDataProvider.future)),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(financeDataProvider.future),
          color: _gold,
          backgroundColor: _surface,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
            children: [
              // 1. Night Audit Status
              _NightAuditBanner(data: data, fmtDateTime: _fmtDateTime, fmtDate: _fmtDate),
              const SizedBox(height: 16),

              // 2. Revenue — Audited + Live (side by side)
              _RevenueStatusSection(data: data, fmtAmount: _fmtAmount, fmtDate: _fmtDate, period: period),
              const SizedBox(height: 20),

              // 3. Revenue KPI Grid (Audited)
              _SectionHeader(label: 'AUDITED BREAKDOWN ($period)'),
              const SizedBox(height: 10),
              _RevenueKpiGrid(rev: data.audited, fmtAmount: _fmtAmount),
              const SizedBox(height: 20),

              // 4. Live Unaudited Activity
              _SectionHeader(label: 'LIVE UNAUDITED ACTIVITY', trailing: 'SINCE AUDIT'),
              const SizedBox(height: 10),
              _LiveActivityCard(live: data.liveSinceLastAudit, fmtAmount: _fmtAmount),
              const SizedBox(height: 20),

              // 5. Cash Control
              _SectionHeader(label: 'CASH CONTROL', trailing: period == 'TODAY' ? 'TODAY\'S SHIFTS' : 'SHIFTS ($period)'),
              const SizedBox(height: 10),
              _CashControlCard(cashControl: data.cashControl, fmtAmount: _fmtAmount, period: period),
              const SizedBox(height: 20),

              // 6. Transaction Controls
              _SectionHeader(label: 'TRANSACTION CONTROLS', trailing: periodSuffix),
              const SizedBox(height: 10),
              _TransactionControlsCard(controls: data.transactionControls, fmtAmount: _fmtAmount),
              const SizedBox(height: 20),

              // 7. Outstanding Receivables
              _SectionHeader(label: 'OUTSTANDING RECEIVABLES', trailing: 'CURRENT'),
              const SizedBox(height: 10),
              _OutstandingCard(outstanding: data.outstanding, fmtAmount: _fmtAmount),
              const SizedBox(height: 20),

              // 8. Guest Credits
              _SectionHeader(label: 'GUEST CREDITS & DEPOSITS', trailing: 'CURRENT'),
              const SizedBox(height: 10),
              _GuestCreditsCard(credits: data.guestCredits, fmtAmount: _fmtAmount),
              const SizedBox(height: 20),

              // 9. Financial Alerts
              if (data.currentAlerts.isNotEmpty) ...[
                _SectionHeader(label: 'CURRENT ALERTS', count: data.currentAlerts.length),
                const SizedBox(height: 10),
                ...data.currentAlerts.map((a) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _AttentionCard(alert: a, fmtAmount: _fmtAmount),
                )),
              ],
            ],
          ),
        ),
      ),
    );
  }

  AppBar _buildAppBar(FinanceDashboardData? data) {
    return AppBar(
      backgroundColor: _navy,
      elevation: 0,
      centerTitle: false,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('FINANCE', style: TextStyle(fontSize: 10, letterSpacing: 2.0, fontWeight: FontWeight.w700, color: _gold)),
          const SizedBox(height: 2),
          Text(data?.property.name ?? 'Loading…', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: _textPrimary, letterSpacing: -0.3)),
          if (data != null) Text(_fmtDate(data.businessDate), style: const TextStyle(fontSize: 11, color: _textMuted, fontWeight: FontWeight.w500)),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: _textMuted),
          onPressed: () => ref.refresh(financeDataProvider.future),
        ),
        const SizedBox(width: 8),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(50),
        child: _PeriodTabs(),
      ),
    );
  }

  Widget _buildSkeleton() => ListView(
    padding: const EdgeInsets.all(16),
    children: List.generate(6, (_) => Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: _Skeleton(height: 100, borderRadius: 16),
    )),
  );

  Widget _buildError(VoidCallback onRetry) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.cloud_off_rounded, color: _textMuted, size: 48),
      const SizedBox(height: 16),
      const Text('Unable to load Finance', style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
      const SizedBox(height: 8),
      const Text('Check your connection and try again.', style: TextStyle(color: _textMuted, fontSize: 13)),
      const SizedBox(height: 20),
      ElevatedButton(
        onPressed: onRetry,
        style: ElevatedButton.styleFrom(backgroundColor: _surface, foregroundColor: _gold),
        child: const Text('Retry'),
      ),
    ]),
  );
}

class _PeriodTabs extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(financePeriodProvider);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 8, 12),
      child: Row(
        children: ['TODAY', 'MTD', 'YTD'].map((p) {
          final isSelected = p == period;
          return Expanded(
            child: GestureDetector(
              onTap: () => ref.read(financePeriodProvider.notifier).state = p,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: isSelected ? _gold : _surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  p,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? _navy : _textMuted,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── 1. Night Audit Banner ────────────────────────────────────────────────────
class _NightAuditBanner extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(String?) fmtDateTime;
  final String Function(String) fmtDate;

  const _NightAuditBanner({required this.data, required this.fmtDateTime, required this.fmtDate});

  @override
  Widget build(BuildContext context) {
    final isAudited = data.lastAuditedBusinessDate != null;
    final color = isAudited ? _green : _orange;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),
            child: Icon(isAudited ? Icons.check_circle_rounded : Icons.pending_rounded, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('NIGHT AUDIT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: color)),
                const SizedBox(height: 3),
                Text(
                  isAudited ? '✓ Audit Completed' : '⏳ Audit Pending',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color),
                ),
                const SizedBox(height: 2),
                if (isAudited)
                  Text('Business date ${fmtDate(data.lastAuditedBusinessDate!)}',
                      style: const TextStyle(fontSize: 11, color: _textMuted))
                else
                  const Text('Official revenue has not yet been finalised for today.', style: TextStyle(fontSize: 11, color: _textMuted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            child: Text(
              isAudited ? 'FINAL' : 'PROVISIONAL',
              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 2. Revenue Status ────────────────────────────────────────────────────────
class _RevenueStatusSection extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(double) fmtAmount;
  final String Function(String) fmtDate;
  final String period;

  const _RevenueStatusSection({required this.data, required this.fmtAmount, required this.fmtDate, required this.period});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Audited Revenue
        Expanded(
          child: _RevenueCard(
            label: 'OFFICIAL / AUDITED',
            amount: data.audited.revenue,
            subtitle: data.lastAuditedBusinessDate != null ? fmtDate(data.lastAuditedBusinessDate!) : 'No audits yet',
            badge: '✓ AUDITED',
            badgeColor: _green,
            isAudited: true,
            fmtAmount: fmtAmount,
          ),
        ),
        const SizedBox(width: 10),
        // Live Since Last Audit
        Expanded(
          child: _RevenueCard(
            label: 'LIVE SINCE AUDIT',
            amount: data.liveSinceLastAudit.revenueActivity,
            subtitle: 'Unaudited Activity',
            badge: '*UNAUDITED',
            badgeColor: _orange,
            isAudited: false,
            breakdown: [
              ('Rooms', data.liveSinceLastAudit.roomCharges),
              ('POS', data.liveSinceLastAudit.posSales),
            ],
            fmtAmount: fmtAmount,
          ),
        ),
      ],
    );
  }
}

class _RevenueCard extends StatelessWidget {
  final String label;
  final double amount;
  final String subtitle;
  final String badge;
  final Color badgeColor;
  final bool isAudited;
  final List<(String, double)>? breakdown;
  final String Function(double) fmtAmount;

  const _RevenueCard({
    required this.label,
    required this.amount,
    required this.subtitle,
    required this.badge,
    required this.badgeColor,
    required this.isAudited,
    required this.fmtAmount,
    this.breakdown,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: _textMuted)),
          const SizedBox(height: 8),
          Text(fmtAmount(amount), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: _textPrimary, letterSpacing: -0.5)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: _textMuted)),
          const SizedBox(height: 8),
          if (breakdown != null) ...[
            ...breakdown!.map((row) => Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(row.$1, style: const TextStyle(fontSize: 11, color: _textMuted)),
                  Text(fmtAmount(row.$2), style: const TextStyle(fontSize: 11, color: _textSecondary, fontWeight: FontWeight.w600)),
                ],
              ),
            )),
            const SizedBox(height: 4),
          ],
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: badgeColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
            ),
            child: Text(badge, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: badgeColor, letterSpacing: 0.5)),
          ),
        ],
      ),
    );
  }
}

// ─── 3. Revenue KPI Grid ──────────────────────────────────────────────────────
class _RevenueKpiGrid extends StatelessWidget {
  final AuditedPeriodData rev;
  final String Function(double) fmtAmount;

  const _RevenueKpiGrid({required this.rev, required this.fmtAmount});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Rooms', rev.roomRevenue, _blue, false),
      ('F&B / POS', rev.fbRevenue, _purple, false),
      ('Other', rev.otherRevenue, _textMuted, false),
      ('Net Revenue', rev.netRevenue, _gold, false),
      ('Discounts', rev.discounts, _orange, true),
      ('Refunds', rev.refunds, _red, true),
      ('Gross Revenue', rev.revenue, _green, false),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
      child: Column(
        children: [
          for (int i = 0; i < items.length; i += 2)
            Padding(
              padding: EdgeInsets.only(bottom: i + 2 < items.length ? 12 : 0),
              child: Row(
                children: [
                  Expanded(child: _KpiItem(label: items[i].$1, value: fmtAmount(items[i].$2), color: items[i].$3, isDeduction: items[i].$4)),
                  if (i + 1 < items.length) ...[
                    Container(width: 1, height: 40, color: _border),
                    Expanded(child: _KpiItem(label: items[i + 1].$1, value: fmtAmount(items[i + 1].$2), color: items[i + 1].$3, isDeduction: items[i + 1].$4)),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _KpiItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool isDeduction;

  const _KpiItem({required this.label, required this.value, required this.color, required this.isDeduction});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: _textMuted, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Row(
            children: [
              if (isDeduction) Text('−', style: TextStyle(fontSize: 13, color: color, fontWeight: FontWeight.w700)),
              Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── 4. Live Unaudited Activity ───────────────────────────────────────────────
class _LiveActivityCard extends StatelessWidget {
  final LiveActivityData live;
  final String Function(double) fmtAmount;

  const _LiveActivityCard({required this.live, required this.fmtAmount});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
      child: Column(
        children: [
          _RowItem(label: 'Room Charges', amount: live.roomCharges, color: _blue, fmtAmount: fmtAmount),
          const Divider(color: _border, height: 20),
          _RowItem(label: 'F&B / POS Sales', amount: live.posSales, color: _purple, fmtAmount: fmtAmount),
          const Divider(color: _border, height: 20),
          _RowItem(label: 'Collections (Payments)', amount: live.collections, color: _gold, fmtAmount: fmtAmount),
        ],
      ),
    );
  }
}

// Shared row helper
class _RowItem extends StatelessWidget {
  final String label;
  final double amount;
  final Color color;
  final String Function(double) fmtAmount;
  const _RowItem({required this.label, required this.amount, required this.color, required this.fmtAmount});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 10),
      Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: _textSecondary))),
      Text(fmtAmount(amount), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
    ],
  );
}


// ─── 7. Outstanding ───────────────────────────────────────────────────────────
class _OutstandingCard extends StatelessWidget {
  final OutstandingReceivables outstanding;
  final String Function(double) fmtAmount;

  const _OutstandingCard({required this.outstanding, required this.fmtAmount});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Guest Balances', outstanding.guestBalances, _orange),
      ('Corporate', outstanding.corporateReceivables, _purple),
      if (outstanding.other > 0) ('Other', outstanding.other, _textMuted),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: outstanding.total > 1_000_000 ? _orange.withValues(alpha: 0.4) : _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('OUTSTANDING RECEIVABLES', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: _textMuted)),
              const Spacer(),
              if (outstanding.total > 1_000_000)
                const Icon(Icons.warning_amber_rounded, color: _orange, size: 16),
            ],
          ),
          const SizedBox(height: 12),
          ...rows.map((r) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: r.$3, shape: BoxShape.circle)),
                const SizedBox(width: 10),
                Text(r.$1, style: const TextStyle(fontSize: 13, color: _textSecondary)),
                const Spacer(),
                Text(fmtAmount(r.$2), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: r.$3)),
              ],
            ),
          )),
          const Divider(color: _border, height: 1),
          const SizedBox(height: 10),
          Row(
            children: [
              const Text('TOTAL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: _textMuted)),
              const Spacer(),
              Text(fmtAmount(outstanding.total), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _textPrimary)),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── 8. Cash Control ─────────────────────────────────────────────────────────
class _CashControlCard extends StatelessWidget {
  final CashControlAggregate cashControl;
  final String Function(double) fmtAmount;
  final String period;

  const _CashControlCard({required this.cashControl, required this.fmtAmount, required this.period});

  Color _statusColor(String status) {
    switch (status) {
      case 'OK': return _green;
      case 'VARIANCE': return _red;
      case 'OVERAGE': return _orange;
      default: return _textMuted;
    }
  }

  Widget _statusIcon(String status) {
    switch (status) {
      case 'OK': return const Icon(Icons.check_circle_rounded, color: _green, size: 16);
      case 'VARIANCE': return const Icon(Icons.error_rounded, color: _red, size: 16);
      case 'OVERAGE': return const Icon(Icons.warning_rounded, color: _orange, size: 16);
      default: return const Icon(Icons.pending_rounded, color: _textMuted, size: 16);
    }
  }

  @override
  Widget build(BuildContext context) {
    // MTD/YTD: show aggregate summary + variance count only
    if (period != 'TODAY') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(child: _CashSummaryChip(label: 'Expected', amount: fmtAmount(cashControl.expected), color: _textSecondary)),
                Expanded(child: _CashSummaryChip(label: 'Declared', amount: fmtAmount(cashControl.declared), color: _textSecondary)),
                Expanded(child: _CashSummaryChip(
                  label: 'Net Variance',
                  amount: '${cashControl.variance >= 0 ? '+' : ''}${fmtAmount(cashControl.variance)}',
                  color: cashControl.variance == 0 ? _green : cashControl.variance < 0 ? _red : _orange,
                )),
              ],
            ),
            if (cashControl.sessionsWithVariance > 0) ...[
              const Divider(color: _border, height: 20),
              Row(
                children: [
                  Text('${cashControl.sessionsWithVariance} sessions with variance',
                      style: const TextStyle(fontSize: 12, color: _textMuted)),
                  const Spacer(),
                  if (cashControl.significantVariances > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: _red.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                      child: Text('${cashControl.significantVariances} significant',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _red)),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: _gold),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                  child: const Text('View Variances →',
                      style: TextStyle(color: _gold, fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ],
        ),
      );
    }

    // TODAY: show individual sessions
    if (cashControl.sessions.isEmpty) {
      return Container(
        height: 70,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
        child: const Text('No open sessions today', style: TextStyle(color: _textMuted, fontSize: 12)),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _CashSummaryChip(label: 'Expected', amount: fmtAmount(cashControl.expected), color: _textSecondary)),
              Expanded(child: _CashSummaryChip(label: 'Declared', amount: fmtAmount(cashControl.declared), color: _textSecondary)),
              Expanded(child: _CashSummaryChip(
                label: 'Variance',
                amount: '${cashControl.variance >= 0 ? '+' : ''}${fmtAmount(cashControl.variance)}',
                color: cashControl.variance == 0 ? _green : cashControl.variance < 0 ? _red : _orange,
              )),
            ],
          ),
          const Divider(color: _border, height: 20),
          ...cashControl.sessions.map((s) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _statusIcon(s.status),
                    const SizedBox(width: 8),
                    Expanded(child: Text(s.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _textPrimary))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(color: _statusColor(s.status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                      child: Text(s.status, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _statusColor(s.status))),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    _SessionStat(label: 'Expected', value: fmtAmount(s.expected)),
                    _SessionStat(label: 'Declared', value: s.declared != null ? fmtAmount(s.declared!) : '—'),
                    _SessionStat(
                      label: 'Variance',
                      value: s.variance != null ? '${s.variance! >= 0 ? '+' : ''}${fmtAmount(s.variance!)}' : '—',
                      color: s.variance == null ? _textMuted : s.variance! == 0 ? _green : s.variance! < 0 ? _red : _orange,
                    ),
                  ],
                ),
              ],
            ),
          )),
        ],
      ),
    );
  }
}

class _CashSummaryChip extends StatelessWidget {
  final String label;
  final String amount;
  final Color color;
  const _CashSummaryChip({required this.label, required this.amount, required this.color});

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(label, style: const TextStyle(fontSize: 10, color: _textMuted)),
      const SizedBox(height: 3),
      Text(amount, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
    ],
  );
}

class _SessionStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _SessionStat({required this.label, required this.value, this.color = _textSecondary});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 9, color: _textMuted)),
        Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
      ],
    ),
  );
}

// ─── 9. Transaction Controls ──────────────────────────────────────────────────
class _TransactionControlsCard extends StatelessWidget {
  final TransactionControlAggregate controls;
  final String Function(double) fmtAmount;

  const _TransactionControlsCard({required this.controls, required this.fmtAmount});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
      child: Column(
        children: [
          _TxRow(label: 'Discounts', amount: fmtAmount(controls.discounts), color: _orange, icon: Icons.discount_rounded),
          const Divider(color: _border, height: 16),
          _TxRow(label: 'Voids', amount: fmtAmount(controls.voids), color: _red, icon: Icons.block_rounded),
          const Divider(color: _border, height: 16),
          _TxRow(label: 'Refunds', amount: fmtAmount(controls.refunds), color: _red, icon: Icons.undo_rounded),
          const Divider(color: _border, height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: _textMuted.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.admin_panel_settings_rounded, color: _textMuted, size: 16),
              ),
              const SizedBox(width: 12),
              const Text('Overrides / Approvals', style: TextStyle(fontSize: 13, color: _textSecondary)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: _border, borderRadius: BorderRadius.circular(20)),
                child: Text('${controls.overrides}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _textPrimary)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TxRow extends StatelessWidget {
  final String label;
  final String amount;
  final Color color;
  final IconData icon;

  const _TxRow({required this.label, required this.amount, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: color, size: 16),
      ),
      const SizedBox(width: 12),
      Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: _textSecondary))),
      Text(amount, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
    ],
  );
}

// ─── 10. Guest Credits ────────────────────────────────────────────────────────
class _GuestCreditsCard extends StatelessWidget {
  final GuestCredits credits;
  final String Function(double) fmtAmount;

  const _GuestCreditsCard({required this.credits, required this.fmtAmount});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Deposits Held', credits.depositsHeld, _gold, Icons.account_balance_wallet_rounded),
      ('Credits Available', credits.creditsAvailable, _green, Icons.savings_rounded),
      ('Credits Consumed', credits.creditsConsumed, _blue, Icons.check_circle_rounded),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
      child: Column(
        children: rows.map((r) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: r.$3.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: Icon(r.$4, color: r.$3, size: 16),
              ),
              const SizedBox(width: 12),
              Text(r.$1, style: const TextStyle(fontSize: 13, color: _textSecondary)),
              const Spacer(),
              Text(fmtAmount(r.$2), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: r.$3)),
            ],
          ),
        )).toList(),
      ),
    );
  }
}

// ─── 11. Financial Alerts ─────────────────────────────────────────────────────
class _AttentionCard extends StatelessWidget {
  final CurrentAlert alert;
  final String Function(double) fmtAmount;

  const _AttentionCard({required this.alert, required this.fmtAmount});

  @override
  Widget build(BuildContext context) {
    final isP0 = alert.priority == 'P0';
    final color = isP0 ? _red : _orange;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(isP0 ? Icons.error_outline_rounded : Icons.warning_amber_rounded, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                      child: Text(alert.priority, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color)),
                    ),
                    const SizedBox(width: 8),
                    Text(alert.category, style: const TextStyle(fontSize: 10, color: _textMuted, letterSpacing: 0.5)),
                  ],
                ),
                const SizedBox(height: 6),
                Text('${alert.affectedCount > 1 ? '${alert.affectedCount}× ' : ''}${alert.title}',
                    style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                if (alert.summary.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(alert.summary, style: const TextStyle(color: _textSecondary, fontSize: 12)),
                ],
                const SizedBox(height: 6),
                Text(fmtAmount(alert.totalAmount), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: color.withValues(alpha: 0.5), size: 18),
        ],
      ),
    );
  }
}

// ─── Shared Widgets ───────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String label;
  final String? trailing;
  final int? count;

  const _SectionHeader({required this.label, this.trailing, this.count});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.4, color: _textMuted)),
      if (count != null) ...[
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(color: _red.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10), border: Border.all(color: _red.withValues(alpha: 0.3))),
          child: Text('$count', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _red)),
        ),
      ],
      const Spacer(),
      if (trailing != null)
        Text(trailing!, style: const TextStyle(fontSize: 10, color: _textMuted, fontWeight: FontWeight.w600)),
    ],
  );
}

class _Skeleton extends StatefulWidget {
  final double height;
  final double borderRadius;
  const _Skeleton({required this.height, required this.borderRadius});

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  late Animation<double> _a;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
    _a = Tween<double>(begin: 0.3, end: 0.7).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut));
  }

  @override
  void dispose() { _c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _a,
    builder: (_, child) => Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: _a.value * 0.08),
        borderRadius: BorderRadius.circular(widget.borderRadius),
      ),
    ),
  );
}

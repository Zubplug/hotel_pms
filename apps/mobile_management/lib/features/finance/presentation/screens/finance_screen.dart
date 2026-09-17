
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/finance_provider.dart';
import '../models/finance_data.dart';

// ─── Design System ─────────────────────────────────────────────────────────────
const _bg0       = Color(0xFF060B14);   // deepest bg
const _bg1       = Color(0xFF0D1526);   // page bg
const _bg2       = Color(0xFF111E35);   // card bg
const _bg3       = Color(0xFF172240);   // elevated card
const _border    = Color(0xFF1E2F4A);
const _borderHi  = Color(0xFF2A4166);

const _gold      = Color(0xFFD4A853);
const _goldDim   = Color(0xFF8A6B2E);
const _goldGlow  = Color(0x33D4A853);

const _emerald   = Color(0xFF10B981);
const _rose      = Color(0xFFF43F5E);
const _roseDim   = Color(0xFF4C0519);
const _amber     = Color(0xFFF59E0B);
const _sky       = Color(0xFF38BDF8);
const _violet    = Color(0xFF8B5CF6);

const _textPrimary   = Color(0xFFF0F6FF);
const _textSecondary = Color(0xFFADBDD4);
const _textMuted     = Color(0xFF526078);
const _textDim       = Color(0xFF374B63);

// ─── Helpers ──────────────────────────────────────────────────────────────────
String _fmtCurrency(double v, String symbol) {
  final s = symbol.isEmpty ? '₦' : symbol;
  if (v >= 1000000000) return '$s${(v / 1000000000).toStringAsFixed(2)}B';
  if (v >= 1000000)    return '$s${(v / 1000000).toStringAsFixed(2)}M';
  if (v >= 1000)       return '$s${(v / 1000).toStringAsFixed(1)}K';
  return '$s${NumberFormat('#,##0').format(v)}';
}

String _fmtDate(String s) {
  if (s.isEmpty) return '—';
  try { return DateFormat('dd MMM yyyy').format(DateTime.parse(s)); } catch (_) { return s; }
}



// ─── Screen ───────────────────────────────────────────────────────────────────
class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});
  @override
  ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen>
    with TickerProviderStateMixin {

  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state  = ref.watch(financeDataProvider);
    final period = ref.watch(financePeriodProvider);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bg1,
        body: state.when(
          loading: () => _buildSkeleton(),
          error:   (e, _) => _buildError(() => ref.refresh(financeDataProvider.future)),
          data:    (data) => RefreshIndicator(
            onRefresh: () => ref.refresh(financeDataProvider.future),
            color: _gold,
            backgroundColor: _bg2,
            child: _buildBody(data, period),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(FinanceDashboardData data, String period) {
    final sym = _getCurrencySymbol(data.property.currency);
    String fmt(double v) => _fmtCurrency(v, sym);

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        _buildSliverAppBar(data, period),
        SliverToBoxAdapter(child: _buildContent(data, period, fmt)),
      ],
    );
  }

  // ─── Sliver App Bar ──────────────────────────────────────────────────────────
  Widget _buildSliverAppBar(FinanceDashboardData data, String period) {
    return SliverAppBar(
      expandedHeight: 120,
      floating: false,
      pinned: true,
      backgroundColor: _bg1,
      elevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.parallax,
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0A1628), Color(0xFF060B14)],
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                top: -60, right: -60,
                child: Container(
                  width: 220, height: 220,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [
                      Color(0x1AD4A853), Colors.transparent,
                    ]),
                  ),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Top row: LIVE badge only
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: _goldGlow,
                              borderRadius: BorderRadius.circular(7),
                              border: Border.all(color: _goldDim, width: 0.5),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 5, height: 5,
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle, color: _gold,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                const Text('LIVE', style: TextStyle(
                                  fontSize: 9, fontWeight: FontWeight.w800,
                                  color: _gold, letterSpacing: 1.5,
                                )),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Financial Intelligence',
                        style: TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w800,
                          color: _textPrimary, letterSpacing: -0.8, height: 1,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${data.property.name}  •  ${_fmtDate(data.businessDate)}',
                        style: const TextStyle(
                          fontSize: 11, color: _textMuted, letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      // ── Pinned collapsed bar: period selector only ──
      title: Row(
        children: [
          const Spacer(),
          _PeriodSelector(
            selected: ref.watch(financePeriodProvider),
            onChanged: (p) => ref.read(financePeriodProvider.notifier).state = p,
            compact: true,
          ),
        ],
      ),
    );
  }

  // ─── Body Content ─────────────────────────────────────────────────────────────
  Widget _buildContent(FinanceDashboardData data, String period, String Function(double) fmt) {
    return AnimatedBuilder(
      animation: _entryCtrl,
      builder: (context, child) {
        return Opacity(
          opacity: _entryCtrl.value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - _entryCtrl.value)),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Audit Status Banner ──
            if (data.lastAuditedBusinessDate != null)
              _AuditStatusBanner(data: data),
            const SizedBox(height: 16),

            // ── Hero Revenue Cards ──
            _HeroRevenueRow(data: data, fmt: fmt),
            const SizedBox(height: 20),

            // ── Revenue Composition ──
            _SectionLabel(title: 'REVENUE BREAKDOWN', subtitle: 'Audited period'),
            const SizedBox(height: 12),
            _RevenueCompositionCard(data: data, fmt: fmt),
            const SizedBox(height: 20),

            // ── Live Unaudited Activity ──
            _SectionLabel(title: 'LIVE ACTIVITY', subtitle: 'Since last audit'),
            const SizedBox(height: 12),
            _LiveActivityCard(data: data, fmt: fmt),
            const SizedBox(height: 20),

            // ── Cash Control ──
            _SectionLabel(
              title: 'CASH CONTROL',
              subtitle: '${data.cashControl.sessions.length} sessions',
              trailingBadge: data.cashControl.significantVariances > 0
                  ? '${data.cashControl.significantVariances} ALERT${data.cashControl.significantVariances > 1 ? 'S' : ''}'
                  : null,
              trailingBadgeColor: _rose,
            ),
            const SizedBox(height: 12),
            _CashControlCard(data: data, fmt: fmt),
            const SizedBox(height: 20),

            // ── Transaction Controls ──
            _SectionLabel(title: 'TRANSACTION CONTROLS', subtitle: 'Exceptions & overrides'),
            const SizedBox(height: 12),
            _TransactionControlsCard(data: data, fmt: fmt),
            const SizedBox(height: 20),

            // ── Receivables & Guest Credit ──
            _SectionLabel(title: 'BALANCE SHEET SNAPSHOT', subtitle: 'Receivables & liabilities'),
            const SizedBox(height: 12),
            _BalanceSheetRow(data: data, fmt: fmt),
            const SizedBox(height: 20),

            // ── Alerts ──
            if (data.currentAlerts.isNotEmpty) ...[
              _SectionLabel(
                title: 'ACTIVE ALERTS',
                subtitle: '${data.currentAlerts.length} item${data.currentAlerts.length > 1 ? 's' : ''} require attention',
                trailingBadge: '${data.currentAlerts.length}',
                trailingBadgeColor: _rose,
              ),
              const SizedBox(height: 12),
              _AlertsList(alerts: data.currentAlerts, fmt: fmt),
            ],
          ],
        ),
      ),
    );
  }

  // ─── Skeleton ────────────────────────────────────────────────────────────────
  Widget _buildSkeleton() {
    return const _ShimmerSkeleton();
  }

  Widget _buildError(VoidCallback onRetry) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: _roseDim, borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _rose.withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.cloud_off_rounded, color: _rose, size: 40),
          ),
          const SizedBox(height: 20),
          const Text('Unable to load financial data',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: _textPrimary)),
          const SizedBox(height: 6),
          const Text('Check your connection and try again',
              style: TextStyle(fontSize: 13, color: _textMuted)),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFB8862A), _gold]),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text('Retry', style: TextStyle(
                fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white,
              )),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
String _getCurrencySymbol(String currency) {
  switch (currency.toUpperCase()) {
    case 'NGN': return '₦';
    case 'USD': return '\$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'KES': return 'KSh';
    default:    return '₦';
  }
}

// ─── Period Selector ─────────────────────────────────────────────────────────
class _PeriodSelector extends StatelessWidget {
  final String selected;
  final void Function(String) onChanged;
  final bool compact;

  const _PeriodSelector({
    required this.selected,
    required this.onChanged,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final periods = ['TODAY', 'WEEK', 'MONTH'];
    final labels  = compact
        ? ['D', 'W', 'M']
        : ['Today', 'Week', 'Month'];

    return Container(
      height: 32,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: _bg0, borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(periods.length, (i) {
          final active = periods[i] == selected;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onChanged(periods[i]);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 12),
              decoration: BoxDecoration(
                color: active ? _gold : Colors.transparent,
                borderRadius: BorderRadius.circular(7),
              ),
              child: Text(
                labels[i],
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: active ? Colors.black : _textMuted,
                  letterSpacing: compact ? 0 : 0.3,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ─── Section Label ───────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? trailingBadge;
  final Color? trailingBadgeColor;

  const _SectionLabel({
    required this.title,
    required this.subtitle,
    this.trailingBadge,
    this.trailingBadgeColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(
              fontSize: 10, fontWeight: FontWeight.w800,
              color: _textMuted, letterSpacing: 1.5,
            )),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(
              fontSize: 12, color: _textSecondary, fontWeight: FontWeight.w500,
            )),
          ],
        ),
        const Spacer(),
        if (trailingBadge != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: (trailingBadgeColor ?? _gold).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: (trailingBadgeColor ?? _gold).withValues(alpha: 0.4)),
            ),
            child: Text(
              trailingBadge!,
              style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w800,
                color: trailingBadgeColor ?? _gold, letterSpacing: 0.8,
              ),
            ),
          ),
      ],
    );
  }
}

// ─── Audit Status Banner ─────────────────────────────────────────────────────
class _AuditStatusBanner extends StatelessWidget {
  final FinanceDashboardData data;
  const _AuditStatusBanner({required this.data});

  @override
  Widget build(BuildContext context) {
    final isCurrent = data.lastAuditedBusinessDate == data.businessDate;
    final color = isCurrent ? _emerald : _amber;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(
            isCurrent ? Icons.verified_rounded : Icons.schedule_rounded,
            color: color, size: 16,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isCurrent
                  ? 'Night audit complete for ${_fmtDate(data.businessDate)}'
                  : 'Last audit: ${_fmtDate(data.lastAuditedBusinessDate ?? '')} — live data shown since',
              style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Hero Revenue Row ────────────────────────────────────────────────────────
class _HeroRevenueRow extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(double) fmt;
  const _HeroRevenueRow({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final rev  = data.audited;
    final netPct = rev.revenue > 0
        ? (rev.netRevenue / rev.revenue * 100)
        : 0.0;

    return Column(
      children: [
        // Main hero
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF172240), Color(0xFF0F1A30)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _borderHi),
            boxShadow: [
              BoxShadow(color: _goldGlow.withValues(alpha: 0.5), blurRadius: 30, offset: const Offset(0, 8)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('GROSS REVENUE', style: TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w700,
                    color: _textMuted, letterSpacing: 1.5,
                  )),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _goldGlow,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('AUDITED', style: TextStyle(
                      fontSize: 9, fontWeight: FontWeight.w800,
                      color: _gold, letterSpacing: 1,
                    )),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                fmt(rev.revenue),
                style: const TextStyle(
                  fontSize: 36, fontWeight: FontWeight.w900,
                  color: _textPrimary, letterSpacing: -1.5,
                  height: 1,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.arrow_downward_rounded, size: 14, color: _rose),
                  const SizedBox(width: 4),
                  Text('${fmt(rev.discounts + rev.refunds)} in deductions',
                      style: const TextStyle(fontSize: 12, color: _textMuted)),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        fmt(rev.netRevenue),
                        style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800,
                          color: _emerald,
                        ),
                      ),
                      Text(
                        'Net  ${netPct.toStringAsFixed(1)}% retained',
                        style: const TextStyle(fontSize: 10, color: _textMuted),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Net revenue bar
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Stack(
                  children: [
                    Container(height: 5, color: _bg0),
                    FractionallySizedBox(
                      widthFactor: (netPct / 100).clamp(0.0, 1.0),
                      child: Container(
                        height: 5,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [_gold, _emerald]),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Sub KPI row
        Row(
          children: [
            Expanded(child: _MiniKpiCard(
              label: 'ROOMS', value: fmt(rev.roomRevenue),
              icon: Icons.bed_rounded, color: _sky,
              pct: rev.revenue > 0 ? rev.roomRevenue / rev.revenue : 0,
            )),
            const SizedBox(width: 10),
            Expanded(child: _MiniKpiCard(
              label: 'F&B', value: fmt(rev.fbRevenue),
              icon: Icons.restaurant_rounded, color: _violet,
              pct: rev.revenue > 0 ? rev.fbRevenue / rev.revenue : 0,
            )),
            const SizedBox(width: 10),
            Expanded(child: _MiniKpiCard(
              label: 'OTHER', value: fmt(rev.otherRevenue),
              icon: Icons.more_horiz_rounded, color: _amber,
              pct: rev.revenue > 0 ? rev.otherRevenue / rev.revenue : 0,
            )),
          ],
        ),
      ],
    );
  }
}

class _MiniKpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final double pct;
  const _MiniKpiCard({
    required this.label, required this.value,
    required this.icon, required this.color, required this.pct,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _bg2, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 5),
              Text(label, style: const TextStyle(
                fontSize: 9, fontWeight: FontWeight.w700,
                color: _textMuted, letterSpacing: 1,
              )),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(
            fontSize: 14, fontWeight: FontWeight.w800,
            color: color,
          )),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: Stack(
              children: [
                Container(height: 3, color: _bg0),
                FractionallySizedBox(
                  widthFactor: pct.clamp(0.0, 1.0),
                  child: Container(
                    height: 3,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text('${(pct * 100).toStringAsFixed(0)}% of total',
              style: const TextStyle(fontSize: 10, color: _textDim)),
        ],
      ),
    );
  }
}

// ─── Revenue Composition Card ────────────────────────────────────────────────
class _RevenueCompositionCard extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(double) fmt;
  const _RevenueCompositionCard({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final rev = data.audited;
    final total = rev.revenue;

    final segments = [
      _RevSegment('Rooms Revenue',     rev.roomRevenue, _sky),
      _RevSegment('F&B Revenue',       rev.fbRevenue,   _violet),
      _RevSegment('Other Revenue',     rev.otherRevenue,_amber),
      _RevSegment('Discounts',         rev.discounts,   _rose),
      _RevSegment('Refunds',           rev.refunds,     _rose.withValues(alpha: 0.6)),
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _bg2, borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: [
          // Stacked bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 10,
              child: Row(
                children: segments.where((s) => s.value > 0).map((s) {
                  return Expanded(
                    flex: (s.value / (total > 0 ? total : 1) * 1000).round(),
                    child: Container(color: s.color),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 18),
          ...segments.map((s) => _RevRow(segment: s, total: total, fmt: fmt)),
        ],
      ),
    );
  }
}

class _RevSegment {
  final String label;
  final double value;
  final Color color;
  const _RevSegment(this.label, this.value, this.color);
}

class _RevRow extends StatelessWidget {
  final _RevSegment segment;
  final double total;
  final String Function(double) fmt;
  const _RevRow({required this.segment, required this.total, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (segment.value / total * 100) : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(color: segment.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Text(segment.label, style: const TextStyle(
            fontSize: 13, color: _textSecondary,
          )),
          const Spacer(),
          Text('${pct.toStringAsFixed(1)}%', style: const TextStyle(
            fontSize: 12, color: _textMuted,
          )),
          const SizedBox(width: 12),
          SizedBox(
            width: 90,
            child: Text(fmt(segment.value), textAlign: TextAlign.right,
                style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700, color: _textPrimary,
                )),
          ),
        ],
      ),
    );
  }
}

// ─── Live Activity ────────────────────────────────────────────────────────────
class _LiveActivityCard extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(double) fmt;
  const _LiveActivityCard({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final live = data.liveSinceLastAudit;

    final items = [
      _LiveItem('Revenue Activity', live.revenueActivity, Icons.trending_up_rounded,  _emerald),
      _LiveItem('Room Charges',     live.roomCharges,     Icons.bed_rounded,           _sky),
      _LiveItem('POS Sales',        live.posSales,        Icons.point_of_sale_rounded, _violet),
      _LiveItem('Collections',      live.collections,     Icons.payments_rounded,      _gold),
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _bg2, borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 8, height: 8,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: _emerald),
                ),
                const SizedBox(width: 8),
                const Text('UNAUDITED — IN PROGRESS', style: TextStyle(
                  fontSize: 10, fontWeight: FontWeight.w700,
                  color: _emerald, letterSpacing: 1,
                )),
              ],
            ),
          ),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            childAspectRatio: 1.8,
            padding: const EdgeInsets.all(4),
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
            children: items.map((item) => _LiveItemCell(item: item, fmt: fmt)).toList(),
          ),
        ],
      ),
    );
  }
}

class _LiveItem {
  final String label;
  final double value;
  final IconData icon;
  final Color color;
  const _LiveItem(this.label, this.value, this.icon, this.color);
}

class _LiveItemCell extends StatelessWidget {
  final _LiveItem item;
  final String Function(double) fmt;
  const _LiveItemCell({required this.item, required this.fmt});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _bg3,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(item.icon, size: 16, color: item.color),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fmt(item.value), style: TextStyle(
                fontSize: 15, fontWeight: FontWeight.w800, color: item.color,
              )),
              Text(item.label, style: const TextStyle(
                fontSize: 10, color: _textMuted,
              )),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Cash Control ─────────────────────────────────────────────────────────────
class _CashControlCard extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(double) fmt;
  const _CashControlCard({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final cc = data.cashControl;
    final varianceColor = cc.variance < 0 ? _rose : cc.variance > 0 ? _amber : _emerald;

    return Column(
      children: [
        // Summary strip
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _bg2, borderRadius: BorderRadius.circular(18),
            border: Border.all(color: _border),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  _CashStat('Expected', fmt(cc.expected), _textSecondary),
                  const _Divider(),
                  _CashStat('Declared', fmt(cc.declared), _textPrimary),
                  const _Divider(),
                  _CashStat('Variance', fmt(cc.variance), varianceColor),
                ],
              ),
              if (cc.sessionsWithVariance > 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: _roseDim,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _rose.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 14, color: _rose),
                      const SizedBox(width: 8),
                      Text(
                        '${cc.sessionsWithVariance} session${cc.sessionsWithVariance > 1 ? 's' : ''} with variance · '
                        '${cc.significantVariances} significant',
                        style: const TextStyle(fontSize: 12, color: _rose, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        // Session list
        if (cc.sessions.isNotEmpty) ...[
          const SizedBox(height: 8),
          ...cc.sessions.map((s) => _CashSessionTile(session: s, fmt: fmt)),
        ],
      ],
    );
  }
}

class _CashStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _CashStat(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: const TextStyle(
            fontSize: 10, color: _textMuted, fontWeight: FontWeight.w600, letterSpacing: 0.5,
          )),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(
            fontSize: 14, fontWeight: FontWeight.w800, color: color,
          )),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 32, color: _border, margin: const EdgeInsets.symmetric(horizontal: 4));
  }
}

class _CashSessionTile extends StatelessWidget {
  final CashSession session;
  final String Function(double) fmt;
  const _CashSessionTile({required this.session, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final hasVariance = session.variance != null && session.variance != 0;
    final color = hasVariance
        ? (session.variance! < 0 ? _rose : _amber)
        : _emerald;
    final isOpen = session.status == 'OPEN';

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _bg2, borderRadius: BorderRadius.circular(12),
        border: Border.all(color: hasVariance ? color.withValues(alpha: 0.3) : _border),
      ),
      child: Row(
        children: [
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isOpen ? _amber : _emerald,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(session.label, style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600, color: _textPrimary,
                )),
                Text(isOpen ? 'Shift in progress' : 'Shift closed',
                    style: const TextStyle(fontSize: 11, color: _textMuted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(fmt(session.expected), style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w700, color: _textSecondary,
              )),
              if (session.variance != null)
                Text(
                  '${session.variance! >= 0 ? '+' : ''}${fmt(session.variance!)}',
                  style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Transaction Controls ─────────────────────────────────────────────────────
class _TransactionControlsCard extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(double) fmt;
  const _TransactionControlsCard({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final tc = data.transactionControls;
    final items = [
      _TxItem('Discounts Given', fmt(tc.discounts), Icons.local_offer_rounded,    _amber,  'Authorized reductions'),
      _TxItem('Voids Processed', fmt(tc.voids),     Icons.remove_circle_rounded,  _rose,   'Cancelled transactions'),
      _TxItem('Refunds Issued',  fmt(tc.refunds),   Icons.assignment_return_rounded,_violet,'Cash back to guests'),
      _TxItem('Overrides',       tc.overrides.toString(), Icons.manage_accounts_rounded, _sky, 'Manager interventions'),
    ];

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      crossAxisCount: 2,
      childAspectRatio: 1.4,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      children: items.map((item) => _TxCard(item: item)).toList(),
    );
  }
}

class _TxItem {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String sublabel;
  const _TxItem(this.label, this.value, this.icon, this.color, this.sublabel);
}

class _TxCard extends StatelessWidget {
  final _TxItem item;
  const _TxCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: _bg2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: item.color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: item.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(item.icon, size: 13, color: item.color),
          ),
          const SizedBox(height: 10),
          Text(item.value, style: TextStyle(
            fontSize: 16, fontWeight: FontWeight.w900,
            color: item.color, letterSpacing: -0.3,
            height: 1.1,
          )),
          const SizedBox(height: 2),
          Text(item.label, style: const TextStyle(
            fontSize: 10, fontWeight: FontWeight.w600, color: _textSecondary,
            height: 1.2,
          )),
          Text(item.sublabel, style: const TextStyle(
            fontSize: 9, color: _textMuted, height: 1.2,
          )),
        ],
      ),
    );
  }
}

// ─── Balance Sheet Row ────────────────────────────────────────────────────────
class _BalanceSheetRow extends StatelessWidget {
  final FinanceDashboardData data;
  final String Function(double) fmt;
  const _BalanceSheetRow({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final out = data.outstanding;
    final gc  = data.guestCredits;

    return Row(
      children: [
        Expanded(
          child: _BalanceCard(
            title: 'RECEIVABLES',
            total: out.total,
            totalLabel: 'Total Outstanding',
            color: _rose,
            icon: Icons.account_balance_rounded,
            lines: [
              _BalanceLine('Guest Balances',     out.guestBalances,       fmt),
              _BalanceLine('Corporate A/R',      out.corporateReceivables,fmt),
              _BalanceLine('Other',              out.other,               fmt),
            ],
            fmt: fmt,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _BalanceCard(
            title: 'GUEST CREDIT',
            total: gc.depositsHeld,
            totalLabel: 'Deposits Held',
            color: _emerald,
            icon: Icons.savings_rounded,
            lines: [
              _BalanceLine('Available Credits', gc.creditsAvailable, fmt),
              _BalanceLine('Consumed Credits',  gc.creditsConsumed,  fmt),
            ],
            fmt: fmt,
          ),
        ),
      ],
    );
  }
}

class _BalanceLine {
  final String label;
  final double value;
  final String Function(double) fmt;
  const _BalanceLine(this.label, this.value, this.fmt);
}

class _BalanceCard extends StatelessWidget {
  final String title;
  final double total;
  final String totalLabel;
  final Color color;
  final IconData icon;
  final List<_BalanceLine> lines;
  final String Function(double) fmt;

  const _BalanceCard({
    required this.title, required this.total, required this.totalLabel,
    required this.color, required this.icon, required this.lines, required this.fmt,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _bg2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(title, style: TextStyle(
                fontSize: 9, fontWeight: FontWeight.w800,
                color: color, letterSpacing: 1,
              )),
            ],
          ),
          const SizedBox(height: 10),
          Text(fmt(total), style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w900,
            color: color, letterSpacing: -0.5,
          )),
          Text(totalLabel, style: const TextStyle(
            fontSize: 10, color: _textMuted,
          )),
          const SizedBox(height: 12),
          const Divider(color: _border, height: 1),
          const SizedBox(height: 10),
          ...lines.map((l) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                Expanded(child: Text(l.label, style: const TextStyle(
                  fontSize: 11, color: _textMuted,
                ))),
                Text(l.fmt(l.value), style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700, color: _textSecondary,
                )),
              ],
            ),
          )),
        ],
      ),
    );
  }
}

// ─── Alerts List ──────────────────────────────────────────────────────────────
class _AlertsList extends StatelessWidget {
  final List<CurrentAlert> alerts;
  final String Function(double) fmt;
  const _AlertsList({required this.alerts, required this.fmt});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: alerts.map((a) => _AlertTile(alert: a, fmt: fmt)).toList(),
    );
  }
}

class _AlertTile extends StatelessWidget {
  final CurrentAlert alert;
  final String Function(double) fmt;
  const _AlertTile({required this.alert, required this.fmt});

  Color get _priorityColor {
    switch (alert.priority) {
      case 'P1': return _rose;
      case 'P2': return _amber;
      default:   return _sky;
    }
  }

  IconData get _categoryIcon {
    switch (alert.category) {
      case 'CASH':    return Icons.payments_rounded;
      case 'REVENUE': return Icons.trending_up_rounded;
      case 'CREDIT':  return Icons.credit_card_rounded;
      default:        return Icons.notifications_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _priorityColor;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_categoryIcon, size: 16, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(alert.title, style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700, color: _textPrimary,
                      )),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Text(alert.priority, style: TextStyle(
                        fontSize: 9, fontWeight: FontWeight.w900,
                        color: color, letterSpacing: 1,
                      )),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(alert.summary, style: const TextStyle(
                  fontSize: 12, color: _textMuted,
                )),
                if (alert.totalAmount > 0 || alert.affectedCount > 0) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (alert.affectedCount > 0)
                        _AlertChip('${alert.affectedCount} affected', color),
                      if (alert.totalAmount > 0) ...[
                        const SizedBox(width: 6),
                        _AlertChip(fmt(alert.totalAmount), color),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertChip extends StatelessWidget {
  final String label;
  final Color color;
  const _AlertChip(this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label, style: TextStyle(
        fontSize: 10, fontWeight: FontWeight.w700, color: color,
      )),
    );
  }
}

// ─── Shimmer Skeleton ─────────────────────────────────────────────────────────
class _ShimmerSkeleton extends StatefulWidget {
  const _ShimmerSkeleton();
  @override
  State<_ShimmerSkeleton> createState() => _ShimmerSkeletonState();
}

class _ShimmerSkeletonState extends State<_ShimmerSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat();
    _anim = Tween<double>(begin: -2, end: 2).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 100, 16, 40),
          children: [
            _skBox(height: 120),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _skBox(height: 80)),
              const SizedBox(width: 10),
              Expanded(child: _skBox(height: 80)),
              const SizedBox(width: 10),
              Expanded(child: _skBox(height: 80)),
            ]),
            const SizedBox(height: 20),
            _skBox(height: 16, width: 100),
            const SizedBox(height: 10),
            _skBox(height: 130),
            const SizedBox(height: 20),
            _skBox(height: 16, width: 120),
            const SizedBox(height: 10),
            _skBox(height: 100),
            const SizedBox(height: 20),
            _skBox(height: 16, width: 80),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _skBox(height: 110)),
              const SizedBox(width: 10),
              Expanded(child: _skBox(height: 110)),
            ]),
          ],
        );
      },
    );
  }

  Widget _skBox({double height = 60, double? width}) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: LinearGradient(
          begin: Alignment(_anim.value - 1, 0),
          end:   Alignment(_anim.value + 1, 0),
          colors: const [
            Color(0xFF111E35),
            Color(0xFF172240),
            Color(0xFF111E35),
          ],
        ),
      ),
    );
  }
}

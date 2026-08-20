import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/finance_provider.dart';
import '../models/finance_data.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _bg = Color(0xFF08090E);
const _surface = Color(0xFF111318);
const _surfaceElevated = Color(0xFF181C24);
const _border = Color(0xFF252A35);
const _gold = Color(0xFFD4AF37);
const _goldDim = Color(0xFFB8962F);
const _textPrimary = Color(0xFFF0F4FF);
const _textSecondary = Color(0xFF8B92A5);
const _textMuted = Color(0xFF4E5566);
const _green = Color(0xFF22C55E);
const _greenDim = Color(0xFF16A34A);
const _red = Color(0xFFEF4444);
const _orange = Color(0xFFF97316);
const _blue = Color(0xFF3B82F6);
const _purple = Color(0xFF8B5CF6);

class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});

  @override
  ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final financeDataAsync = ref.watch(financeDataProvider);

    return Scaffold(
      backgroundColor: _bg,
      body: financeDataAsync.when(
        data: (data) => _buildBody(data),
        loading: () => const Center(child: CircularProgressIndicator(color: _gold)),
        error: (err, stack) => _buildError(err),
      ),
    );
  }

  Widget _buildBody(FinanceDashboardData data) {
    final currencySymbol = data.property.currency == 'NGN' ? '₦' : '\$';
    final fmt = NumberFormat.compactCurrency(symbol: currencySymbol);
    final fmtFull = NumberFormat.currency(symbol: currencySymbol, decimalDigits: 0);
    final generatedAt = DateTime.tryParse(data.generatedAt) ?? DateTime.now();

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(financeDataProvider),
      color: _gold,
      backgroundColor: _surface,
      child: CustomScrollView(
        slivers: [
          // ── Sticky Header ─────────────────────────────────────────────────
          SliverAppBar(
            pinned: true,
            expandedHeight: 0,
            backgroundColor: _bg,
            elevation: 0,
            surfaceTintColor: Colors.transparent,
            flexibleSpace: Container(
              decoration: BoxDecoration(
                color: _bg,
                border: Border(bottom: BorderSide(color: _border, width: 0.5)),
              ),
            ),
            title: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      data.property.name.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                        color: _textSecondary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        AnimatedBuilder(
                          animation: _pulseAnim,
                          builder: (_, __) => Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _green.withOpacity(_pulseAnim.value),
                            ),
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          'Live · ${timeago.format(generatedAt)}',
                          style: const TextStyle(fontSize: 10, color: _textMuted),
                        ),
                      ],
                    ),
                  ],
                ),
                const Spacer(),
                _PillBadge(
                  label: data.businessDate,
                  color: _gold,
                ),
              ],
            ),
          ),

          SliverList(
            delegate: SliverChildListDelegate([
              const SizedBox(height: 20),

              // ── Hero Revenue Card ────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _HeroRevenueCard(data: data, fmt: fmt, fmtFull: fmtFull),
              ),
              const SizedBox(height: 16),

              // ── KPI Row ─────────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _KpiRow(data: data, fmt: fmt),
              ),
              const SizedBox(height: 24),

              // ── Attention Alerts ─────────────────────────────────────────
              if (data.attention.isNotEmpty) ...[
                _SectionHeader(label: 'REQUIRES ATTENTION', count: data.attention.length),
                const SizedBox(height: 10),
                ...data.attention.map((a) => Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: _AttentionCard(alert: a, fmt: fmt),
                )),
                const SizedBox(height: 16),
              ],

              // ── Hotel Performance ────────────────────────────────────────
              const _SectionHeader(label: 'HOTEL PERFORMANCE'),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _HotelPerformanceCard(data: data, fmt: fmt),
              ),
              const SizedBox(height: 24),

              // ── Revenue Mix ──────────────────────────────────────────────
              const _SectionHeader(label: 'REVENUE MIX'),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _RevenueMixCard(data: data, fmt: fmt),
              ),
              const SizedBox(height: 24),

              // ── Payments Breakdown ───────────────────────────────────────
              const _SectionHeader(label: 'PAYMENTS COLLECTED'),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _PaymentsCard(data: data, fmt: fmt),
              ),
              const SizedBox(height: 24),

              // ── Revenue Trend ────────────────────────────────────────────
              const _SectionHeader(label: '7-DAY REVENUE TREND'),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _TrendCard(data: data, fmt: fmt),
              ),

              const SizedBox(height: 60),
            ]),
          ),
        ],
      ),
    );
  }

  // ── Skeleton Loading ────────────────────────────────────────────────────────
  Widget _buildSkeleton() {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Fake app bar
          Container(
            height: 64,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: _bg,
              border: Border(bottom: BorderSide(color: _border, width: 0.5)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Skeleton(height: 10, width: 140, borderRadius: 4),
                    const SizedBox(height: 6),
                    _Skeleton(height: 8, width: 90, borderRadius: 4),
                  ],
                ),
                const Spacer(),
                _Skeleton(height: 26, width: 80, borderRadius: 20),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Hero revenue card skeleton
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: _surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Skeleton(height: 22, width: 190, borderRadius: 20),
                  const SizedBox(height: 20),
                  _Skeleton(height: 50, width: double.infinity, borderRadius: 8),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      _Skeleton(height: 26, width: 150, borderRadius: 6),
                      const Spacer(),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          _Skeleton(height: 8, width: 70, borderRadius: 3),
                          const SizedBox(height: 5),
                          _Skeleton(height: 18, width: 90, borderRadius: 4),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Divider(color: _border, height: 1),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _Skeleton(height: 36, borderRadius: 8)),
                      const SizedBox(width: 16),
                      Expanded(child: _Skeleton(height: 36, borderRadius: 8)),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // KPI row — 3 cards
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: List.generate(3, (i) => Expanded(
                child: Padding(
                  padding: EdgeInsets.only(left: i == 0 ? 0 : 10),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: _border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Skeleton(height: 28, width: 28, borderRadius: 8),
                        const SizedBox(height: 10),
                        _Skeleton(height: 18, width: 50, borderRadius: 4),
                        const SizedBox(height: 5),
                        _Skeleton(height: 9, width: 55, borderRadius: 3),
                      ],
                    ),
                  ),
                ),
              )),
            ),
          ),
          const SizedBox(height: 24),

          // Section: Hotel Performance
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _Skeleton(height: 10, width: 140, borderRadius: 4),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _border),
              ),
              child: Row(
                children: [
                  _Skeleton(height: 80, width: 80, borderRadius: 40),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Skeleton(height: 9, width: 90, borderRadius: 4),
                        const SizedBox(height: 8),
                        _Skeleton(height: 8, width: double.infinity, borderRadius: 4),
                        const SizedBox(height: 14),
                        Row(children: [
                          Expanded(child: _Skeleton(height: 30, borderRadius: 6)),
                          const SizedBox(width: 12),
                          Expanded(child: _Skeleton(height: 30, borderRadius: 6)),
                        ]),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Section: Revenue Mix
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _Skeleton(height: 10, width: 110, borderRadius: 4),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _border),
              ),
              child: Column(
                children: List.generate(4, (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _Skeleton(height: 10, width: 100, borderRadius: 4),
                          _Skeleton(height: 10, width: 60, borderRadius: 4),
                        ],
                      ),
                      const SizedBox(height: 7),
                      _Skeleton(height: 5, width: double.infinity, borderRadius: 3),
                    ],
                  ),
                )),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Section: Revenue Trend
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _Skeleton(height: 10, width: 150, borderRadius: 4),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _Skeleton(height: 32, width: 100, borderRadius: 6),
                      _Skeleton(height: 24, width: 80, borderRadius: 6),
                    ],
                  ),
                  const SizedBox(height: 24),
                  // Bar columns with varying heights to feel natural
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [55.0, 70.0, 45.0, 80.0, 60.0, 90.0, 40.0].map((h) =>
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: _Skeleton(height: h, borderRadius: 6),
                        ),
                      ),
                    ).toList(),
                  ),
                  const SizedBox(height: 10),
                  // Day label stubs
                  Row(
                    children: List.generate(7, (_) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: _Skeleton(height: 8, borderRadius: 3),
                      ),
                    )),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 60),
        ],
      ),
    );
  }

  Widget _buildError(Object err) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off_rounded, color: _textMuted, size: 48),
          const SizedBox(height: 16),
          const Text('Could not load financial data',
              style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text('$err', style: const TextStyle(color: _textSecondary, fontSize: 12),
              textAlign: TextAlign.center),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () => ref.refresh(financeDataProvider),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: _gold,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('Retry', style: TextStyle(color: _bg, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Hero Revenue Card ─────────────────────────────────────────────────────────
class _HeroRevenueCard extends StatelessWidget {
  final FinanceDashboardData data;
  final NumberFormat fmt;
  final NumberFormat fmtFull;
  const _HeroRevenueCard({required this.data, required this.fmt, required this.fmtFull});

  @override
  Widget build(BuildContext context) {
    final isUp = data.revenue.changePercent >= 0;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF161A24), Color(0xFF0F1219)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _gold.withOpacity(0.25), width: 1),
        boxShadow: [
          BoxShadow(color: _gold.withOpacity(0.06), blurRadius: 32, offset: const Offset(0, 8)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _gold.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _gold.withOpacity(0.3)),
                ),
                child: const Text(
                  "TODAY'S POSTED REVENUE",
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                      letterSpacing: 1.2, color: _gold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Big number
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              fmtFull.format(data.revenue.posted),
              style: const TextStyle(
                fontSize: 48,
                fontWeight: FontWeight.w800,
                color: _textPrimary,
                letterSpacing: -1,
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Change badge
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: (isUp ? _green : _red).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: (isUp ? _green : _red).withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(isUp ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                        color: isUp ? _green : _red, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      '${data.revenue.changePercent.abs().toStringAsFixed(1)}% vs yesterday',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isUp ? _green : _red,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              // Outstanding chip
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Outstanding', style: TextStyle(fontSize: 10, color: _textMuted)),
                  const SizedBox(height: 2),
                  Text(
                    fmt.format(data.outstanding.total),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _orange),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 20),
          Divider(color: _border, height: 1),
          const SizedBox(height: 16),

          // Collected vs Outstanding mini row
          Row(
            children: [
              _MiniStat(
                label: 'Payments Collected',
                value: fmt.format(data.payments.total),
                color: _green,
                icon: Icons.check_circle_outline_rounded,
              ),
              const SizedBox(width: 24),
              _MiniStat(
                label: 'Balance Outstanding',
                value: fmt.format(data.outstanding.total),
                color: _orange,
                icon: Icons.access_time_rounded,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _MiniStat({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 10, color: _textMuted)),
              Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── KPI Row ──────────────────────────────────────────────────────────────────
class _KpiRow extends StatelessWidget {
  final FinanceDashboardData data;
  final NumberFormat fmt;
  const _KpiRow({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _KpiCard(label: 'Occupancy', value: '${data.performance.occupancy.toStringAsFixed(0)}%',
            icon: Icons.bed_rounded, color: _blue),
        const SizedBox(width: 10),
        _KpiCard(label: 'ADR', value: fmt.format(data.performance.adr),
            icon: Icons.payments_rounded, color: _purple),
        const SizedBox(width: 10),
        _KpiCard(label: 'RevPAR', value: fmt.format(data.performance.revpar),
            icon: Icons.bar_chart_rounded, color: _gold),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _KpiCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 14),
            ),
            const SizedBox(height: 10),
            Text(value,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: _textPrimary)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 10, color: _textMuted)),
          ],
        ),
      ),
    );
  }
}

// ─── Hotel Performance Card ────────────────────────────────────────────────────
class _HotelPerformanceCard extends StatelessWidget {
  final FinanceDashboardData data;
  final NumberFormat fmt;
  const _HotelPerformanceCard({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final occupancy = data.performance.occupancy / 100;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: [
          // Occupancy gauge
          Row(
            children: [
              SizedBox(
                width: 80,
                height: 80,
                child: CustomPaint(
                  painter: _OccupancyGaugePainter(progress: occupancy),
                  child: Center(
                    child: Text(
                      '${data.performance.occupancy.toStringAsFixed(0)}%',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: _textPrimary),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Occupancy Rate', style: TextStyle(color: _textSecondary, fontSize: 12)),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: occupancy,
                        backgroundColor: _border,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          occupancy > 0.8 ? _green : occupancy > 0.5 ? _gold : _orange,
                        ),
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _PerfStat(label: 'ADR', value: fmt.format(data.performance.adr), color: _purple),
                        _PerfStat(label: 'RevPAR', value: fmt.format(data.performance.revpar), color: _gold),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PerfStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _PerfStat({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: _textMuted)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }
}

// Occupancy gauge painter — uses solid colour arc (no SweepGradient) to avoid
// the dart:ui assertion that fires when startAngle == endAngle at progress == 0.
class _OccupancyGaugePainter extends CustomPainter {
  final double progress;
  const _OccupancyGaugePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 6;
    const startAngle = pi * 0.75;
    const sweepMax = pi * 1.5;

    // Track ring
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepMax,
      false,
      Paint()
        ..color = _border
        ..strokeWidth = 8
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // Filled arc — only draw when there is something to show
    final clampedProgress = progress.clamp(0.0, 1.0);
    if (clampedProgress > 0) {
      final color = clampedProgress > 0.8 ? _green
          : clampedProgress > 0.5 ? _gold
          : _orange;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweepMax * clampedProgress,
        false,
        Paint()
          ..color = color
          ..strokeWidth = 8
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );

      // Glow dot at tip
      final tipAngle = startAngle + sweepMax * clampedProgress;
      final tipX = center.dx + radius * cos(tipAngle);
      final tipY = center.dy + radius * sin(tipAngle);
      canvas.drawCircle(
        Offset(tipX, tipY),
        5,
        Paint()..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_OccupancyGaugePainter old) => old.progress != progress;
}

// ─── Revenue Mix Card ─────────────────────────────────────────────────────────
class _RevenueMixCard extends StatelessWidget {
  final FinanceDashboardData data;
  final NumberFormat fmt;
  const _RevenueMixCard({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final total = data.revenueMix.accommodation +
        data.revenueMix.foodAndBeverage +
        data.revenueMix.bar +
        data.revenueMix.other;

    final items = [
      _MixItem('Accommodation', data.revenueMix.accommodation, _blue),
      _MixItem('F&B', data.revenueMix.foodAndBeverage, _green),
      _MixItem('Bar', data.revenueMix.bar, _purple),
      _MixItem('Other', data.revenueMix.other, _orange),
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: [
          ...items.map((item) {
            final pct = total > 0 ? item.amount / total : 0.0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(width: 8, height: 8,
                              decoration: BoxDecoration(color: item.color, shape: BoxShape.circle)),
                          const SizedBox(width: 8),
                          Text(item.label, style: const TextStyle(color: _textSecondary, fontSize: 13)),
                        ],
                      ),
                      Row(
                        children: [
                          Text(fmt.format(item.amount),
                              style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                          const SizedBox(width: 8),
                          Text('${(pct * 100).toStringAsFixed(0)}%',
                              style: const TextStyle(color: _textMuted, fontSize: 11)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      backgroundColor: _border,
                      valueColor: AlwaysStoppedAnimation<Color>(item.color),
                      minHeight: 5,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _MixItem {
  final String label;
  final double amount;
  final Color color;
  const _MixItem(this.label, this.amount, this.color);
}

// ─── Payments Card ────────────────────────────────────────────────────────────
class _PaymentsCard extends StatelessWidget {
  final FinanceDashboardData data;
  final NumberFormat fmt;
  const _PaymentsCard({required this.data, required this.fmt});

  static const _methodIcons = {
    'CASH': Icons.payments_rounded,
    'CARD': Icons.credit_card_rounded,
    'TRANSFER': Icons.swap_horiz_rounded,
    'POS': Icons.point_of_sale_rounded,
    'CHEQUE': Icons.receipt_long_rounded,
  };

  @override
  Widget build(BuildContext context) {
    if (data.payments.byMethod.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _border),
        ),
        child: const Center(
          child: Text('No payments recorded today', style: TextStyle(color: _textMuted)),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: data.payments.byMethod.asMap().entries.map((entry) {
          final i = entry.key;
          final m = entry.value;
          final icon = _methodIcons[m.method.toUpperCase()] ?? Icons.account_balance_wallet_rounded;
          final pct = data.payments.total > 0 ? m.amount / data.payments.total : 0.0;

          return Column(
            children: [
              if (i > 0) Divider(color: _border.withOpacity(0.6), height: 20),
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: _green.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: _green, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(m.method, style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                            Text(fmt.format(m.amount), style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.w800, fontSize: 15)),
                          ],
                        ),
                        const SizedBox(height: 5),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(3),
                          child: LinearProgressIndicator(
                            value: pct,
                            backgroundColor: _border,
                            valueColor: const AlwaysStoppedAnimation<Color>(_green),
                            minHeight: 4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          );
        }).toList(),
      ),
    );
  }
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────
class _TrendCard extends StatelessWidget {
  final FinanceDashboardData data;
  final NumberFormat fmt;
  const _TrendCard({required this.data, required this.fmt});

  @override
  Widget build(BuildContext context) {
    if (data.trend.days.isEmpty) return const SizedBox.shrink();

    final maxRev = data.trend.days.fold(0.0, (m, d) => d.revenue > m ? d.revenue : m);
    final totalTrend = data.trend.days.fold(0.0, (acc, d) => acc + d.revenue);
    final avgRev = data.trend.days.isNotEmpty ? totalTrend / data.trend.days.length : 0.0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Period Total', style: TextStyle(color: _textMuted, fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(fmt.format(totalTrend),
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: _textPrimary)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Daily Avg', style: TextStyle(color: _textMuted, fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(fmt.format(avgRev),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _gold)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Bar chart
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: data.trend.days.map((day) {
                final ratio = maxRev > 0 ? day.revenue / maxRev : 0.0;
                final isToday = day.businessDate == data.businessDate;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (isToday)
                          Container(
                            width: 4, height: 4,
                            decoration: const BoxDecoration(color: _gold, shape: BoxShape.circle),
                          ),
                        const SizedBox(height: 4),
                        Stack(
                          alignment: Alignment.bottomCenter,
                          children: [
                            Container(
                              height: 90,
                              decoration: BoxDecoration(
                                color: _border.withOpacity(0.4),
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                            Container(
                              height: 90 * ratio,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.bottomCenter,
                                  end: Alignment.topCenter,
                                  colors: isToday
                                      ? [_gold, _goldDim]
                                      : [_blue.withOpacity(0.8), _blue.withOpacity(0.4)],
                                ),
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _dayLabel(day.businessDate),
                          style: TextStyle(
                            color: isToday ? _gold : _textMuted,
                            fontSize: 10,
                            fontWeight: isToday ? FontWeight.w700 : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  String _dayLabel(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.weekday % 7];
    } catch (_) { return ''; }
  }
}

// ─── Attention Card ────────────────────────────────────────────────────────────
class _AttentionCard extends StatelessWidget {
  final FinancialAttention alert;
  final NumberFormat fmt;
  const _AttentionCard({required this.alert, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final isP0 = alert.priority == 'P0';
    final color = isP0 ? _red : _orange;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              isP0 ? Icons.error_outline_rounded : Icons.warning_amber_rounded,
              color: color, size: 20,
            ),
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
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(alert.priority,
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color)),
                    ),
                    const SizedBox(width: 8),
                    Text(alert.category,
                        style: const TextStyle(fontSize: 10, color: _textMuted, letterSpacing: 0.5)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${alert.affectedCount} ${alert.title}',
                  style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w700),
                ),
                if (alert.summary.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(alert.summary, style: const TextStyle(color: _textSecondary, fontSize: 12)),
                ],
                const SizedBox(height: 6),
                Text(fmt.format(alert.totalAmount),
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: color.withOpacity(0.5), size: 18),
        ],
      ),
    );
  }
}

// ─── Shared Widgets ────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String label;
  final int? count;
  const _SectionHeader({required this.label, this.count});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700,
                  letterSpacing: 1.4, color: _textMuted)),
          if (count != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: _red.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _red.withOpacity(0.3)),
              ),
              child: Text('$count',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _red)),
            ),
          ],
        ],
      ),
    );
  }
}

class _PillBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _PillBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color, letterSpacing: 0.5)),
    );
  }
}

class _Skeleton extends StatefulWidget {
  final double height;
  final double? width;
  final double borderRadius;
  const _Skeleton({required this.height, this.width, required this.borderRadius});

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
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _a,
      builder: (_, __) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(_a.value * 0.08),
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      ),
    );
  }
}

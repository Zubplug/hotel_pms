import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _surface = Color(0xFF111827);
const _surfaceElevated = Color(0xFF1A2535);
const _border = Color(0xFF1E3048);
const _gold = Color(0xFFD4AF37);
const _goldSoft = Color(0xFFF5D778);
const _sapphire = Color(0xFF3B82F6);
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);

/// Dual-line premium trend chart: Gold = Revenue, Blue dashed = Occupancy %
/// With day-of-week X labels, touch tooltips, legend row, and 7d changePercent chip.
class PerformanceTrendChart extends StatefulWidget {
  final PerformanceTrends trends;

  const PerformanceTrendChart({super.key, required this.trends});

  @override
  State<PerformanceTrendChart> createState() => _PerformanceTrendChartState();
}

class _PerformanceTrendChartState extends State<PerformanceTrendChart> {
  int? _touchedIndex;

  @override
  Widget build(BuildContext context) {
    if (widget.trends.days.isEmpty) return const SizedBox.shrink();

    final sortedDays = List<TrendDay>.from(widget.trends.days)
      ..sort((a, b) => a.businessDate.compareTo(b.businessDate));

    // Revenue axis
    final revenues = sortedDays.map((d) => d.revenue).toList();
    final maxRev = revenues.reduce((a, b) => a > b ? a : b);
    final minRev = revenues.reduce((a, b) => a < b ? a : b);
    final revPadding = (maxRev - minRev) * 0.15;

    // Occupancy axis (0–100)
    final occs = sortedDays.map((d) => d.occupancyPct).toList();
    final hasOcc = occs.any((o) => o > 0);

    // Normalize occupancy to revenue scale for dual-axis rendering
    // occ% maps to [minRev, maxRev] range
    double occToRevScale(double occ) {
      if (maxRev <= 0) return 0;
      return (occ / 100.0) * (maxRev + revPadding);
    }

    final revSpots = sortedDays.asMap().entries
        .map((e) => FlSpot(e.key.toDouble(), e.value.revenue))
        .toList();
    final occSpots = sortedDays.asMap().entries
        .map((e) => FlSpot(e.key.toDouble(), occToRevScale(e.value.occupancyPct)))
        .toList();

    final trendUp = widget.trends.changePercent >= 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Text(
                '7-DAY PERFORMANCE',
                style: TextStyle(
                  color: _textMuted,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              // changePercent chip
              if (widget.trends.changePercent != 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: trendUp
                        ? _emerald.withValues(alpha: 0.12)
                        : _rose.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: trendUp
                          ? _emerald.withValues(alpha: 0.3)
                          : _rose.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        trendUp
                            ? Icons.trending_up_rounded
                            : Icons.trending_down_rounded,
                        color: trendUp ? _emerald : _rose,
                        size: 12,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        '${trendUp ? '+' : ''}${widget.trends.changePercent.toStringAsFixed(1)}%',
                        style: TextStyle(
                          color: trendUp ? _emerald : _rose,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(width: 8),
              // 7-day total
              Text(
                _fmtCurrency(widget.trends.total),
                style: const TextStyle(
                  color: _textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Chart
          SizedBox(
            height: 140,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: maxRev > 0 ? (maxRev + revPadding) / 4 : 1,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: _border,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 22,
                      getTitlesWidget: (value, meta) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= sortedDays.length) return const SizedBox();
                        final d = sortedDays[idx];
                        try {
                          final dt = DateTime.parse(d.businessDate);
                          return Padding(
                            padding: const EdgeInsets.only(top: 5),
                            child: Text(
                              DateFormat('EEE').format(dt).toUpperCase(),
                              style: const TextStyle(
                                color: _textMuted,
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          );
                        } catch (_) {
                          return const SizedBox();
                        }
                      },
                    ),
                  ),
                ),
                minX: 0,
                maxX: (sortedDays.length - 1).toDouble(),
                minY: minRev > revPadding ? minRev - revPadding : 0,
                maxY: maxRev + revPadding,
                lineBarsData: [
                  // Revenue line — Gold
                  LineChartBarData(
                    spots: revSpots,
                    isCurved: true,
                    color: _gold,
                    barWidth: 2.5,
                    isStrokeCapRound: true,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (spot, pct, bar, idx) => FlDotCirclePainter(
                        radius: _touchedIndex == idx ? 5 : 3,
                        color: _gold,
                        strokeWidth: 1.5,
                        strokeColor: _surface,
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        colors: [
                          _gold.withValues(alpha: 0.12),
                          _gold.withValues(alpha: 0.0),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                  // Occupancy line — Blue dashed
                  if (hasOcc)
                    LineChartBarData(
                      spots: occSpots,
                      isCurved: true,
                      color: _sapphire.withValues(alpha: 0.8),
                      barWidth: 2,
                      isStrokeCapRound: true,
                      dashArray: [4, 4],
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(show: false),
                    ),
                ],
                lineTouchData: LineTouchData(
                  handleBuiltInTouches: true,
                  touchCallback: (event, response) {
                    if (response?.lineBarSpots != null) {
                      setState(() {
                        _touchedIndex = response!.lineBarSpots!.first.spotIndex;
                      });
                    } else {
                      setState(() => _touchedIndex = null);
                    }
                  },
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => const Color(0xFF1A2535),
                    tooltipBorder: const BorderSide(color: _border),
                    getTooltipItems: (spots) {
                      final idx = spots.first.spotIndex;
                      if (idx >= sortedDays.length) return [];
                      final day = sortedDays[idx];
                      return [
                        LineTooltipItem(
                          _fmtCurrency(day.revenue),
                          const TextStyle(
                            color: _gold,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                          children: [
                            if (hasOcc && day.occupancyPct > 0)
                              TextSpan(
                                text: '\n${day.occupancyPct.toStringAsFixed(1)}% occ',
                                style: const TextStyle(
                                  color: _sapphire,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 11,
                                ),
                              ),
                          ],
                        ),
                        // Don't add a second item for the occ spot — handled above
                        if (spots.length > 1) LineTooltipItem('', const TextStyle()),
                      ];
                    },
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Legend row
          Row(
            children: [
              _LegendDot(color: _gold, label: 'Revenue', dashed: false),
              const SizedBox(width: 16),
              if (hasOcc)
                _LegendDot(color: _sapphire, label: 'Occupancy %', dashed: true),
            ],
          ),
        ],
      ),
    );
  }

  String _fmtCurrency(double v) {
    if (v >= 1000000) return '\u20A6${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '\u20A6${(v / 1000).toStringAsFixed(1)}K';
    if (v <= 0) return '\u20A60';
    return '\u20A6${v.toStringAsFixed(0)}';
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  final bool dashed;

  const _LegendDot({required this.color, required this.label, required this.dashed});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (dashed)
          Row(children: [
            Container(width: 6, height: 2, color: color),
            const SizedBox(width: 2),
            Container(width: 3, height: 2, color: color),
            const SizedBox(width: 2),
          ])
        else
          Container(
            width: 12,
            height: 2,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: color.withValues(alpha: 0.8),
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

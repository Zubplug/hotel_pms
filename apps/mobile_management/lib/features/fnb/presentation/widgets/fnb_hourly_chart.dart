import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/fnb_dashboard_data.dart';

const _surface = Color(0xFF111827);
const _surfaceElevated = Color(0xFF1A2535);
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _gold = Color(0xFFD4AF37);
const _amber = Color(0xFFF59E0B);
const _sapphire = Color(0xFF3B82F6);
const _textPrimary = Color(0xFFF8FAFC);
const _textMuted = Color(0xFF64748B);

/// Hourly revenue bar chart with meal-period colour zones
class FnbHourlyChart extends StatelessWidget {
  final List<FnbHourlySlot> hourlyData;

  const FnbHourlyChart({super.key, required this.hourlyData});

  // Meal period classification (hotel standard)
  Color _periodColor(int hour) {
    if (hour >= 6 && hour <= 10) return _amber;       // Breakfast
    if (hour >= 11 && hour <= 15) return _emerald;    // Lunch
    if (hour >= 16 && hour <= 17) return _sapphire;   // Afternoon Tea / Snacks
    if (hour >= 18 && hour <= 22) return _gold;       // Dinner
    return _surfaceElevated;                           // Late night / Quiet hours
  }

  String _periodLabel(int hour) {
    if (hour >= 6 && hour <= 10)  return 'Breakfast';
    if (hour >= 11 && hour <= 15) return 'Lunch';
    if (hour >= 16 && hour <= 17) return 'Snacks';
    if (hour >= 18 && hour <= 22) return 'Dinner';
    return 'Off-peak';
  }

  String _hourLabel(int hour) {
    if (hour == 0)  return '12a';
    if (hour < 12)  return '${hour}a';
    if (hour == 12) return '12p';
    return '${hour - 12}p';
  }

  @override
  Widget build(BuildContext context) {
    if (hourlyData.isEmpty) {
      return _buildEmpty();
    }

    // Build full 24-slot map (fill gaps with 0)
    final Map<int, double> revenueByHour = {
      for (final s in hourlyData) s.hour: s.revenue
    };

    final maxRevenue = revenueByHour.values.isEmpty
        ? 1.0
        : revenueByHour.values.reduce((a, b) => a > b ? a : b);

    // Find peak hour
    final peakHour = revenueByHour.entries.isEmpty
        ? -1
        : revenueByHour.entries.reduce((a, b) => a.value > b.value ? a : b).key;

    // Only show hours 6–23 (filter out deep-night empties unless data exists)
    final displayHours = List.generate(24, (i) => i)
        .where((h) => (h >= 6) || revenueByHour.containsKey(h))
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Peak hour badge
          if (peakHour >= 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _gold.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: _gold.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.bolt_rounded, color: _gold, size: 12),
                  const SizedBox(width: 4),
                  Text(
                    'Peak: ${_hourLabel(peakHour)} · ${_periodLabel(peakHour)}',
                    style: const TextStyle(
                      color: _gold,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 16),

          // Bar chart
          SizedBox(
            height: 120,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceBetween,
                maxY: maxRevenue * 1.15,
                minY: 0,
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      final hour = displayHours[group.x];
                      final rev = revenueByHour[hour] ?? 0;
                      if (rev == 0) return null;
                      return BarTooltipItem(
                        '${_hourLabel(hour)}\n₦${_formatShort(rev)}',
                        const TextStyle(color: _textPrimary, fontSize: 10, fontWeight: FontWeight.w600),
                      );
                    },
                  ),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 20,
                      getTitlesWidget: (value, meta) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= displayHours.length) return const SizedBox.shrink();
                        final hour = displayHours[idx];
                        // Only show every 3rd label to prevent crowding
                        if (hour % 3 != 0) return const SizedBox.shrink();
                        return Text(
                          _hourLabel(hour),
                          style: const TextStyle(color: _textMuted, fontSize: 8),
                        );
                      },
                    ),
                  ),
                ),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: maxRevenue / 4,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: _border.withValues(alpha: 0.5),
                    strokeWidth: 0.5,
                  ),
                ),
                borderData: FlBorderData(show: false),
                barGroups: displayHours.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final hour = entry.value;
                  final rev = revenueByHour[hour] ?? 0;
                  final isPeak = hour == peakHour;
                  final color = isPeak ? _gold : _periodColor(hour);

                  return BarChartGroupData(
                    x: idx,
                    barRods: [
                      BarChartRodData(
                        toY: rev,
                        color: color.withValues(alpha: rev > 0 ? (isPeak ? 1.0 : 0.7) : 0.15),
                        width: 8,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                        backDrawRodData: BackgroundBarChartRodData(
                          show: true,
                          toY: maxRevenue * 1.15,
                          color: _surfaceElevated.withValues(alpha: 0.3),
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Meal period legend
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              _PeriodDot(color: _amber,   label: 'Breakfast'),
              _PeriodDot(color: _emerald, label: 'Lunch'),
              _PeriodDot(color: _sapphire, label: 'Snacks'),
              _PeriodDot(color: _gold,    label: 'Dinner'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Container(
      height: 100,
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: const Center(
        child: Text('No hourly data today', style: TextStyle(color: _textMuted, fontSize: 13)),
      ),
    );
  }

  String _formatShort(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }
}

class _PeriodDot extends StatelessWidget {
  final Color color;
  final String label;

  const _PeriodDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(color: _textMuted, fontSize: 9)),
      ],
    );
  }
}

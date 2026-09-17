import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../models/fnb_dashboard_data.dart';

const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _sapphire = Color(0xFF3B82F6);
const _violet = Color(0xFF8B5CF6);
const _textPrimary = Color(0xFFF8FAFC);
const _textMuted = Color(0xFF64748B);

/// 7-day stacked bar chart: Food + Beverage + Bar (mutually exclusive)
class FnbRevenueTrend extends StatelessWidget {
  final List<FnbTrendDay> days;

  const FnbRevenueTrend({super.key, required this.days});

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox.shrink();

    final maxTotal = days.map((d) => d.total).fold<double>(0.0, (a, b) => a > b ? a : b);
    final safeMax = maxTotal > 0 ? maxTotal * 1.2 : 1000.0;

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Legend
          Row(
            children: [
              _Dot(color: _emerald,  label: 'Food'),
              const SizedBox(width: 12),
              _Dot(color: _sapphire, label: 'Beverage'),
              const SizedBox(width: 12),
              _Dot(color: _violet,   label: 'Bar'),
            ],
          ),
          const SizedBox(height: 16),

          SizedBox(
            height: 130,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceBetween,
                maxY: safeMax,
                minY: 0,
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      final day = days[group.x];
                      return BarTooltipItem(
                        _shortDate(day.date) + '\n₦' + _shortFmt(day.total),
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
                        if (idx < 0 || idx >= days.length) return const SizedBox.shrink();
                        return Text(
                          _shortDate(days[idx].date),
                          style: const TextStyle(color: _textMuted, fontSize: 8),
                        );
                      },
                    ),
                  ),
                ),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: safeMax / 4,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: _border.withValues(alpha: 0.5),
                    strokeWidth: 0.5,
                  ),
                ),
                borderData: FlBorderData(show: false),
                barGroups: days.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final day = entry.value;
                  final isToday = idx == days.length - 1;

                  // Use fbRevenue split into food/bev proportionally
                  // (food + beverage = fbRevenue; bar is separate bucket)
                  final foodAmt = day.foodRevenue > 0
                      ? day.foodRevenue
                      : day.fbRevenue * 0.65; // conservative split if no granular data
                  final bevAmt = day.beverageRevenue > 0
                      ? day.beverageRevenue
                      : day.fbRevenue * 0.35;

                  return BarChartGroupData(
                    x: idx,
                    barRods: [
                      BarChartRodData(
                        toY: day.total,
                        width: 20,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        rodStackItems: [
                          BarChartRodStackItem(0, foodAmt, _emerald.withValues(alpha: isToday ? 1.0 : 0.7)),
                          BarChartRodStackItem(foodAmt, foodAmt + bevAmt, _sapphire.withValues(alpha: isToday ? 1.0 : 0.7)),
                          BarChartRodStackItem(foodAmt + bevAmt, day.total, _violet.withValues(alpha: isToday ? 1.0 : 0.7)),
                        ],
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _shortDate(String date) {
    try {
      final d = DateTime.parse(date);
      return DateFormat('dd/MM').format(d);
    } catch (_) {
      return date;
    }
  }

  String _shortFmt(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }
}

class _Dot extends StatelessWidget {
  final Color color;
  final String label;

  const _Dot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(color: _textMuted, fontSize: 10)),
      ],
    );
  }
}

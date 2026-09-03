import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../models/executive_dashboard_data.dart';
import 'package:intl/intl.dart';

class PerformanceTrendChart extends StatelessWidget {
  final PerformanceTrends trends;

  const PerformanceTrendChart({super.key, required this.trends});

  @override
  Widget build(BuildContext context) {
    if (trends.days.isEmpty) return const SizedBox.shrink();

    final maxRevenue = trends.days.map((d) => d.revenue).reduce((a, b) => a > b ? a : b);
    final minRevenue = trends.days.map((d) => d.revenue).reduce((a, b) => a < b ? a : b);
    
    // Sort chronologically just in case
    final sortedDays = List<TrendDay>.from(trends.days)
      ..sort((a, b) => a.businessDate.compareTo(b.businessDate));

    final spots = sortedDays.asMap().entries.map((e) {
      return FlSpot(e.key.toDouble(), e.value.revenue);
    }).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '7-DAY REVENUE TREND',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 10,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                _formatCurrency(trends.total),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 120,
            child: LineChart(
              LineChartData(
                gridData: const FlGridData(show: false),
                titlesData: const FlTitlesData(show: false),
                borderData: FlBorderData(show: false),
                minX: 0,
                maxX: (sortedDays.length - 1).toDouble(),
                minY: minRevenue * 0.9,
                maxY: maxRevenue * 1.1,
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: const Color(0xFFD4AF37), // Gold accent
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: const Color(0xFFD4AF37).withOpacity(0.1),
                    ),
                  ),
                ],
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipItems: (touchedSpots) {
                      return touchedSpots.map((spot) {
                        return LineTooltipItem(
                          _formatCurrency(spot.y),
                          const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                        );
                      }).toList();
                    },
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatCurrency(double amount) {
    if (amount >= 1000000) {
      return '₦${(amount / 1000000).toStringAsFixed(1)}M';
    } else if (amount >= 1000) {
      return '₦${(amount / 1000).toStringAsFixed(1)}K';
    }
    return NumberFormat.currency(symbol: '₦', decimalDigits: 0).format(amount);
  }
}

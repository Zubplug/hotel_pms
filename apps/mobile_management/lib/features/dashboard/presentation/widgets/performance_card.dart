import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/executive_dashboard_data.dart';

class PerformanceCard extends StatelessWidget {
  final PerformanceData data;

  const PerformanceCard({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const textSecondary = Color(0xFF94A3B8);

    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TODAY\'S PERFORMANCE',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 2.0,
              fontWeight: FontWeight.w700,
              color: textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            currencyFormat.format(data.todayRevenue),
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(
                data.revenueTrendPercent >= 0 ? Icons.arrow_upward : Icons.arrow_downward,
                color: data.revenueTrendPercent >= 0 ? Colors.greenAccent : Colors.redAccent,
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                '${data.revenueTrendPercent.abs().toStringAsFixed(1)}% vs yesterday',
                style: TextStyle(
                  color: data.revenueTrendPercent >= 0 ? Colors.greenAccent : Colors.redAccent,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildSubMetric('Occupancy', '${data.occupancyPercent.toStringAsFixed(0)}%'),
              _buildSubMetric('ADR', NumberFormat.compactCurrency(symbol: '₦').format(data.adr)),
              _buildSubMetric('RevPAR', NumberFormat.compactCurrency(symbol: '₦').format(data.revpar)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSubMetric(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }
}

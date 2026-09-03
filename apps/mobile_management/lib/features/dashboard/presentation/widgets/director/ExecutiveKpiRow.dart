import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';
import 'package:intl/intl.dart';

class ExecutiveKpiRow extends StatelessWidget {
  final ExecutiveOverview overview;
  final String businessDate; // e.g. '2026-09-03'

  const ExecutiveKpiRow({super.key, required this.overview, required this.businessDate});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildKpiCard('OCCUPANCY', '${overview.occupancyPercent}%', overview.occupancyTrend, false)),
            const SizedBox(width: 8),
            Expanded(child: _buildKpiCard('ADR', _formatCurrency(overview.adr), overview.adrTrend, true, isUnaudited: true)),
            const SizedBox(width: 8),
            Expanded(child: _buildKpiCard('REVPAR', _formatCurrency(overview.revpar), overview.revparTrend, true, isUnaudited: true)),
          ],
        ),
        const SizedBox(height: 4),
        const Align(
          alignment: Alignment.centerRight,
          child: Text('*Based on current operational data', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontStyle: FontStyle.italic)),
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('REVENUE', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, letterSpacing: 1.2, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('OFFICIAL / LAST AUDIT', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(_formatCurrency(overview.lastAuditedRevenue), style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(_formatDate(overview.lastAuditedDate), style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      const SizedBox(height: 2),
                      Row(
                        children: const [
                          Icon(Icons.check, color: Colors.greenAccent, size: 12),
                          SizedBox(width: 4),
                          Text('Audited', style: TextStyle(color: Colors.greenAccent, fontSize: 12)),
                        ],
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('LIVE TODAY', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text('${_formatCurrency(overview.liveRevenue)}*', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(_formatDate(businessDate), style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      const SizedBox(height: 2),
                      const Text('*Unaudited', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontStyle: FontStyle.italic)),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSubRevenue(String label, double amount) {
    return Row(
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
        const SizedBox(width: 8),
        Text(_formatCurrency(amount), style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildKpiCard(String title, String value, double trend, bool isCurrency, {bool isUnaudited = false}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10, letterSpacing: 1.0, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(isUnaudited ? '$value*' : value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          _buildTrendIndicator(trend),
        ],
      ),
    );
  }

  Widget _buildTrendIndicator(double trend) {
    if (trend == 0) return const Text('-', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12));
    
    final isPositive = trend > 0;
    final color = isPositive ? Colors.greenAccent : Colors.redAccent;
    final icon = isPositive ? Icons.arrow_upward : Icons.arrow_downward;
    
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 12),
        const SizedBox(width: 2),
        Text('${trend.abs()}%', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
      ],
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

  String _formatDate(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final date = DateTime.parse(dateStr);
      return DateFormat('dd MMM yyyy').format(date);
    } catch (e) {
      return dateStr;
    }
  }
}

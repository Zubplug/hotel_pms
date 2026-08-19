import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/finance_provider.dart';
import '../models/finance_data.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;

class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});

  @override
  ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen> {
  final currencyFormat = NumberFormat.compactCurrency(symbol: '₦'); // Hardcoding symbol for now, could be dynamic from API

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const surfaceNavy = Color(0xFF1E293B);
    const textPrimary = Colors.white;
    const textSecondary = Color(0xFF94A3B8);
    const goldAccent = Color(0xFFD4AF37);

    final financeDataAsync = ref.watch(financeDataProvider);

    return Scaffold(
      backgroundColor: primaryNavy,
      appBar: AppBar(
        backgroundColor: primaryNavy,
        elevation: 0,
        title: financeDataAsync.when(
          data: (data) {
            final generatedAt = DateTime.parse(data.generatedAt);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'FINANCE',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2, color: textSecondary),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.circle, color: Colors.green, size: 8),
                    const SizedBox(width: 6),
                    Text(
                      'Live · Updated ${timeago.format(generatedAt)} / Business Date · ${data.businessDate}',
                      style: const TextStyle(fontSize: 10, color: textPrimary),
                    ),
                  ],
                ),
              ],
            );
          },
          loading: () => const Text('Loading...', style: TextStyle(fontSize: 14)),
          error: (err, stack) => const Text('Offline', style: TextStyle(fontSize: 14)),
        ),
      ),
      body: financeDataAsync.when(
        data: (data) {
          final fmt = NumberFormat.compactCurrency(symbol: data.property.currency == 'NGN' ? '₦' : '\$');

          return RefreshIndicator(
            onRefresh: () async {
              return ref.refresh(financeDataProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                // 1. Financial Performance
                _buildSectionHeader('TODAY\'S POSTED REVENUE'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: surfaceNavy,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: goldAccent.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fmt.format(data.revenue.posted),
                        style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: textPrimary),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            data.revenue.changePercent >= 0 ? Icons.arrow_upward : Icons.arrow_downward,
                            color: data.revenue.changePercent >= 0 ? Colors.green : Colors.red,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${data.revenue.changePercent.abs().toStringAsFixed(1)}% vs previous day',
                            style: TextStyle(
                              color: data.revenue.changePercent >= 0 ? Colors.green : Colors.red,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // 2. Cash Position
                Row(
                  children: [
                    Expanded(child: _buildMetricCard('Payments Collected', fmt.format(data.payments.total), Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildMetricCard('Outstanding', fmt.format(data.outstanding.total), Colors.orange)),
                  ],
                ),
                const SizedBox(height: 32),

                // 3. Financial Attention
                if (data.attention.isNotEmpty) ...[
                  _buildSectionHeader('FINANCIAL ATTENTION'),
                  const SizedBox(height: 8),
                  ...data.attention.map((alert) => _buildAttentionCard(alert, fmt)),
                  const SizedBox(height: 32),
                ],

                // 4. Revenue Mix
                _buildSectionHeader('REVENUE MIX'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: surfaceNavy,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      _buildMixRow('Accommodation', fmt.format(data.revenueMix.accommodation)),
                      const Divider(color: Colors.white12, height: 24),
                      _buildMixRow('F&B', fmt.format(data.revenueMix.foodAndBeverage)),
                      const Divider(color: Colors.white12, height: 24),
                      _buildMixRow('Bar', fmt.format(data.revenueMix.bar)),
                      const Divider(color: Colors.white12, height: 24),
                      _buildMixRow('Other', fmt.format(data.revenueMix.other)),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                // 5. Hotel Performance
                _buildSectionHeader('HOTEL PERFORMANCE'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: _buildMetricCard('Occupancy', '${data.performance.occupancy}%', Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildMetricCard('ADR', fmt.format(data.performance.adr), Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildMetricCard('RevPAR', fmt.format(data.performance.revpar), Colors.blue)),
                  ],
                ),
                const SizedBox(height: 32),

                // 6. Collections
                _buildSectionHeader('PAYMENTS COLLECTED'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: surfaceNavy,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: data.payments.byMethod.map((m) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(m.method, style: const TextStyle(color: textPrimary, fontSize: 16)),
                            Text(fmt.format(m.amount), style: const TextStyle(color: textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 32),

                // 7. Revenue Trend
                _buildSectionHeader('REVENUE TREND'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: surfaceNavy,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${data.trend.days.length} DAYS',
                        style: const TextStyle(color: textSecondary, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 16),
                      // A simple bar chart representation
                      SizedBox(
                        height: 120,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: data.trend.days.map((day) {
                            double maxRev = data.trend.days.fold(0.0, (m, d) => d.revenue > m ? d.revenue : m);
                            double heightRatio = maxRev > 0 ? (day.revenue / maxRev) : 0;
                            return Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Container(
                                  width: 24,
                                  height: 80 * heightRatio,
                                  decoration: BoxDecoration(
                                    color: goldAccent,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _formatDayLabel(day.businessDate),
                                  style: const TextStyle(color: textSecondary, fontSize: 10),
                                ),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        fmt.format(data.trend.days.fold(0.0, (acc, d) => acc + d.revenue)),
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: textPrimary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 48),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Text(
              'Failed to load finance data.\n$err',
              style: const TextStyle(color: Colors.red),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        color: Color(0xFF94A3B8),
        fontSize: 12,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: accentColor, width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildMixRow(String title, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(color: Colors.white, fontSize: 16)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildAttentionCard(FinancialAttention alert, NumberFormat fmt) {
    Color iconColor = alert.priority == 'P0' ? Colors.red : Colors.orange;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, color: iconColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${alert.affectedCount} ${alert.title}',
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  '${fmt.format(alert.totalAmount)} ${alert.title.toLowerCase().contains("balance") ? "outstanding" : ""}',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.white54),
        ],
      ),
    );
  }
  
  String _formatDayLabel(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      return days[date.weekday % 7];
    } catch (_) {
      return '';
    }
  }
}

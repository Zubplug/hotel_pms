import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/dashboard_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardState = ref.watch(dashboardDataProvider);
    final currencyFormatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦');

    // LodgeCore Executive Theme Colors
    const primaryNavy = Color(0xFF0F172A);
    const goldAccent = Color(0xFFD4AF37);
    const surfaceNavy = Color(0xFF1E293B);
    const textPrimary = Colors.white;
    const textSecondary = Color(0xFF94A3B8);

    final propertyName = dashboardState.value?['property']?['name'] as String? ?? 'LodgeCore';

    return Scaffold(
      backgroundColor: primaryNavy,
      appBar: AppBar(
        backgroundColor: primaryNavy,
        elevation: 0,
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'LODGECORE HOTELS',
              style: TextStyle(
                fontSize: 10,
                letterSpacing: 2.0,
                fontWeight: FontWeight.w700,
                color: goldAccent,
              ),
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  propertyName,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.arrow_drop_down, color: textSecondary, size: 24),
              ],
            ),
          ],
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: textSecondary),
                onPressed: () {},
              ),
              Positioned(
                right: 12,
                top: 12,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.redAccent,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
          CircleAvatar(
            radius: 16,
            backgroundColor: surfaceNavy,
            child: const Icon(Icons.person, color: goldAccent, size: 20),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: dashboardState.when(
        data: (data) {
          final kpi = data['kpi'] as Map<String, dynamic>? ?? {};
          final alerts = (data['alerts'] as List<dynamic>?) ?? [];
          
          final revenueData = kpi['revenue'] as Map<String, dynamic>? ?? {};
          final totalRevenue = revenueData['totalRevenue'] as num? ?? 0;
          final occupancy = kpi['occupancyPercent'] as num? ?? 0;
          final adr = kpi['adr'] as num? ?? 0;
          final revpar = kpi['revpar'] as num? ?? 0;

          return RefreshIndicator(
            color: goldAccent,
            backgroundColor: surfaceNavy,
            onRefresh: () async {
              // ignore: unused_result
              ref.invalidate(dashboardDataProvider);
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // KPI Grid
                  Row(
                    children: [
                      Expanded(
                        child: _buildKPICard(
                          title: 'TODAY\'S REVENUE',
                          value: currencyFormatter.format(totalRevenue),
                          surfaceColor: surfaceNavy,
                          textColor: textPrimary,
                          subtitleColor: textSecondary,
                          valueColor: goldAccent,
                          isLarge: true,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildKPICard(
                          title: 'OCCUPANCY',
                          value: '${occupancy.toStringAsFixed(1)}%',
                          surfaceColor: surfaceNavy,
                          textColor: textPrimary,
                          subtitleColor: textSecondary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildKPICard(
                          title: 'ADR',
                          value: currencyFormatter.format(adr),
                          surfaceColor: surfaceNavy,
                          textColor: textPrimary,
                          subtitleColor: textSecondary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildKPICard(
                          title: 'REVPAR',
                          value: currencyFormatter.format(revpar),
                          surfaceColor: surfaceNavy,
                          textColor: textPrimary,
                          subtitleColor: textSecondary,
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 32),
                  const Text(
                    'ATTENTION ENGINE',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: textSecondary,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  if (alerts.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: surfaceNavy,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Center(
                        child: Text(
                          'No critical items require your attention.',
                          style: TextStyle(color: textSecondary),
                        ),
                      ),
                    )
                  else
                    ...alerts.map((alert) {
                      final p = alert['priority'] as String? ?? 'P3';
                      final title = alert['title'] as String? ?? 'Alert';
                      final summary = alert['summary'] as String? ?? '';
                      final cat = alert['category'] as String? ?? 'OPERATIONS';

                      IconData icon = Icons.info_outline;
                      Color iconColor = goldAccent;
                      if (cat == 'CRITICAL' || p == 'P0') {
                        icon = Icons.warning_amber_rounded;
                        iconColor = Colors.redAccent;
                      } else if (cat == 'APPROVALS') {
                        icon = Icons.fact_check_outlined;
                        iconColor = Colors.blueAccent;
                      } else if (cat == 'FINANCE') {
                        icon = Icons.attach_money;
                        iconColor = Colors.greenAccent;
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: surfaceNavy,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: (p == 'P0') ? Colors.redAccent.withValues(alpha: 0.3) : Colors.transparent,
                          )
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: primaryNavy,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(icon, color: iconColor, size: 24),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    style: const TextStyle(
                                      color: textPrimary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    summary,
                                    style: const TextStyle(
                                      color: textSecondary,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: textSecondary),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: goldAccent)),
        error: (error, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
                const SizedBox(height: 16),
                Text(
                  'Failed to load dashboard',
                  style: const TextStyle(color: textPrimary, fontSize: 18),
                ),
                const SizedBox(height: 8),
                Text(
                  error.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: textSecondary),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: goldAccent,
                    foregroundColor: primaryNavy,
                  ),
                  onPressed: () => ref.invalidate(dashboardDataProvider),
                  child: const Text('RETRY', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKPICard({
    required String title,
    required String value,
    required Color surfaceColor,
    required Color textColor,
    required Color subtitleColor,
    Color? valueColor,
    bool isLarge = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              color: subtitleColor,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontSize: isLarge ? 32 : 20,
                fontWeight: FontWeight.bold,
                color: valueColor ?? textColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

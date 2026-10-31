import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _navy = Color(0xFF0F172A);
const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _gold = Color(0xFFD4AF37);
const _goldSoft = Color(0xFFF5D778);
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);
const _amber = Color(0xFFF59E0B);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);

// ─── Hero Revenue Card ────────────────────────────────────────────────────────
/// Full-width audited revenue card. Live revenue is intentionally excluded:
/// revenue becomes official only after Night Audit completes.
class HeroRevenueCard extends StatelessWidget {
  final ExecutiveOverview overview;
  final PerformanceTrends trends;

  const HeroRevenueCard({
    super.key,
    required this.overview,
    required this.trends,
  });

  @override
  Widget build(BuildContext context) {
    final isAudited = overview.lastAuditedDate.isNotEmpty;
    final trendUp = trends.changePercent >= 0;

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _border),
        boxShadow: [
          BoxShadow(
            color: _gold.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    const Text(
                      'REVENUE INTELLIGENCE',
                      style: TextStyle(
                        color: _textMuted,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    // 7-day trend chip
                    if (trends.changePercent != 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
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
                              '${trendUp ? '+' : ''}${trends.changePercent.toStringAsFixed(1)}% 7d',
                              style: TextStyle(
                                color: trendUp ? _emerald : _rose,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),

                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF17253B), Color(0xFF111827)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _gold.withValues(alpha: .18)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: (isAudited ? _emerald : _amber).withValues(
                            alpha: .13,
                          ),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isAudited
                              ? Icons.verified_rounded
                              : Icons.pending_actions_rounded,
                          color: isAudited ? _emerald : _amber,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'AUDITED REVENUE',
                              style: TextStyle(
                                color: _textMuted,
                                fontSize: 10,
                                letterSpacing: 1.4,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              _fmtAmount(overview.lastAuditedRevenue),
                              style: const TextStyle(
                                color: _textPrimary,
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.8,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isAudited
                                  ? 'Official result · ${_formatDate(overview.lastAuditedDate)}'
                                  : 'Awaiting Night Audit completion',
                              style: const TextStyle(
                                color: _textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isAudited)
                        const Icon(
                          Icons.lock_rounded,
                          color: _emerald,
                          size: 18,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day.toString().padLeft(2, '0')} ${_month(date.month)} ${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _month(int month) => const [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][month];

  String _fmtAmount(double v) {
    if (v >= 1000000) return '₦${(v / 1000000).toStringAsFixed(2)}M';
    if (v >= 1000) return '₦${(v / 1000).toStringAsFixed(1)}K';
    if (v <= 0) return '₦0';
    return '₦${v.toStringAsFixed(0)}';
  }
}

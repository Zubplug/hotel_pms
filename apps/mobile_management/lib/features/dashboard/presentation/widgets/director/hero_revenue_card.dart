import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _navy = Color(0xFF0F172A);
const _surface = Color(0xFF111827);
const _surfaceElevated = Color(0xFF1A2535);
const _border = Color(0xFF1E3048);
const _gold = Color(0xFFD4AF37);
const _goldSoft = Color(0xFFF5D778);
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);
const _sapphire = Color(0xFF3B82F6);
const _violet = Color(0xFF8B5CF6);
const _amber = Color(0xFFF59E0B);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);

// ─── Hero Revenue Card ────────────────────────────────────────────────────────
/// Full-width premium revenue card showing Live vs Audited revenue,
/// a horizontal breakdown bar (Rooms / F&B / Other), and 7-day trend.
class HeroRevenueCard extends StatelessWidget {
  final ExecutiveOverview overview;
  final PerformanceTrends trends;
  final String businessDate;

  const HeroRevenueCard({
    super.key,
    required this.overview,
    required this.trends,
    required this.businessDate,
  });

  @override
  Widget build(BuildContext context) {
    final totalForBreakdown = overview.roomRevenue + overview.fbRevenue + overview.barRevenue + overview.otherRevenue;
    final roomPct = totalForBreakdown > 0 ? overview.roomRevenue / totalForBreakdown : 0.0;
    final fbPct = totalForBreakdown > 0 ? (overview.fbRevenue + overview.barRevenue) / totalForBreakdown : 0.0;
    final otherPct = totalForBreakdown > 0 ? overview.otherRevenue / totalForBreakdown : 0.0;

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
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
                              trendUp ? Icons.trending_up_rounded : Icons.trending_down_rounded,
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

                // Live vs Audited — side by side
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // LIVE TODAY
                    Expanded(
                      child: _RevenueColumn(
                        label: 'LIVE TODAY',
                        amount: overview.liveRevenue,
                        subtitle: _formatDate(businessDate),
                        badge: '*UNAUDITED',
                        badgeColor: _amber,
                        amountColor: _textPrimary,
                        isLarge: true,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 80,
                      color: _border,
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    // OFFICIAL / AUDITED
                    Expanded(
                      child: _RevenueColumn(
                        label: 'OFFICIAL / AUDITED',
                        amount: overview.lastAuditedRevenue,
                        subtitle: isAudited ? _formatDate(overview.lastAuditedDate) : 'No audit yet',
                        badge: isAudited ? '✓ AUDITED' : 'PENDING',
                        badgeColor: isAudited ? _emerald : _amber,
                        amountColor: _textSecondary,
                        isLarge: false,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Revenue Breakdown Bar
                if (totalForBreakdown > 0) ...[
                  const Text(
                    'REVENUE MIX',
                    style: TextStyle(
                      color: _textMuted,
                      fontSize: 9,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Stacked bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Row(
                      children: [
                        if (roomPct > 0)
                          Expanded(
                            flex: (roomPct * 100).round(),
                            child: Container(height: 8, color: _sapphire),
                          ),
                        if (fbPct > 0)
                          Expanded(
                            flex: (fbPct * 100).round(),
                            child: Container(height: 8, color: _violet),
                          ),
                        if (otherPct > 0)
                          Expanded(
                            flex: (otherPct * 100).round(),
                            child: Container(height: 8, color: _surfaceElevated),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  // Legend + values
                  Row(
                    children: [
                      _BreakdownLegend(
                        color: _sapphire,
                        label: 'Rooms',
                        value: _fmtAmount(overview.roomRevenue),
                        pct: roomPct,
                      ),
                      const SizedBox(width: 12),
                      _BreakdownLegend(
                        color: _violet,
                        label: 'F&B',
                        value: _fmtAmount(overview.fbRevenue + overview.barRevenue),
                        pct: fbPct,
                      ),
                      if (overview.otherRevenue > 0) ...[
                        const SizedBox(width: 12),
                        _BreakdownLegend(
                          color: _textMuted,
                          label: 'Other',
                          value: _fmtAmount(overview.otherRevenue),
                          pct: otherPct,
                        ),
                      ],
                    ],
                  ),
                ],
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
      return DateFormat('dd MMM yyyy').format(date);
    } catch (_) {
      return dateStr;
    }
  }

  String _fmtAmount(double v) {
    if (v >= 1000000) return '₦${(v / 1000000).toStringAsFixed(2)}M';
    if (v >= 1000) return '₦${(v / 1000).toStringAsFixed(1)}K';
    if (v <= 0) return '₦0';
    return '₦${v.toStringAsFixed(0)}';
  }
}

class _RevenueColumn extends StatelessWidget {
  final String label;
  final double amount;
  final String subtitle;
  final String badge;
  final Color badgeColor;
  final Color amountColor;
  final bool isLarge;

  const _RevenueColumn({
    required this.label,
    required this.amount,
    required this.subtitle,
    required this.badge,
    required this.badgeColor,
    required this.amountColor,
    required this.isLarge,
  });

  String _fmtAmount(double v) {
    if (v >= 1000000) return '₦${(v / 1000000).toStringAsFixed(2)}M';
    if (v >= 1000) return '₦${(v / 1000).toStringAsFixed(1)}K';
    if (v <= 0) return '₦0';
    return '₦${v.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: _textMuted,
            fontSize: 9,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w700,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 6),
        Text(
          _fmtAmount(amount),
          style: TextStyle(
            color: amountColor,
            fontSize: isLarge ? 26 : 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(color: _textMuted, fontSize: 10),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: badgeColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
          ),
          child: Text(
            badge,
            style: TextStyle(
              color: badgeColor,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _BreakdownLegend extends StatelessWidget {
  final Color color;
  final String label;
  final String value;
  final double pct;

  const _BreakdownLegend({
    required this.color,
    required this.label,
    required this.value,
    required this.pct,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(color: _textMuted, fontSize: 10),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                '$value (${(pct * 100).toStringAsFixed(0)}%)',
                style: const TextStyle(
                  color: _textSecondary,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

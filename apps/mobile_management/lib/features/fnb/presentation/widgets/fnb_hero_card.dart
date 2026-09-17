import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/fnb_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _emerald = Color(0xFF10B981);
const _sapphire = Color(0xFF3B82F6);
const _violet = Color(0xFF8B5CF6);
const _gold = Color(0xFFD4AF37);
const _rose = Color(0xFFF43F5E);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF64748B);

final _fmt = NumberFormat('#,##0', 'en');
final _fmtK = NumberFormat('#,##0.0', 'en');

String _fmtAmt(double v) {
  if (v >= 1000000) return '₦${_fmtK.format(v / 1000000)}M';
  if (v >= 1000) return '₦${_fmtK.format(v / 1000)}K';
  if (v <= 0) return '₦0';
  return '₦${_fmt.format(v)}';
}

/// Full-width hero card: total F&B revenue + covers + avg check + trend badge
class FnbHeroCard extends StatelessWidget {
  final FnbSummary summary;
  final String businessDate;

  const FnbHeroCard({
    super.key,
    required this.summary,
    required this.businessDate,
  });

  @override
  Widget build(BuildContext context) {
    final trendUp = summary.revenueTrend >= 0;
    final stackedTotal = summary.stackedTotal;
    final foodPct   = stackedTotal > 0 ? summary.foodRevenue      / stackedTotal : 0.0;
    final bevPct    = stackedTotal > 0 ? summary.beverageRevenue   / stackedTotal : 0.0;
    final barPct    = stackedTotal > 0 ? summary.barRevenue        / stackedTotal : 0.0;

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0D1F18), Color(0xFF111827)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _emerald.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: _emerald.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header row ──────────────────────────────────────────────────
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _emerald.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: _emerald.withValues(alpha: 0.25)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.restaurant_rounded, color: _emerald, size: 12),
                      SizedBox(width: 5),
                      Text(
                        'F&B INTELLIGENCE',
                        style: TextStyle(
                          color: _emerald,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                // Trend badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (trendUp ? _emerald : _rose).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: (trendUp ? _emerald : _rose).withValues(alpha: 0.3),
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
                        '${trendUp ? '+' : ''}${summary.revenueTrend.toStringAsFixed(1)}% vs yday',
                        style: TextStyle(
                          color: trendUp ? _emerald : _rose,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // ── Total Revenue ────────────────────────────────────────────────
            Text(
              'TOTAL F&B REVENUE',
              style: const TextStyle(
                color: _textMuted,
                fontSize: 10,
                letterSpacing: 1.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _fmtAmt(summary.totalFnbRevenue),
              style: const TextStyle(
                color: _textPrimary,
                fontSize: 34,
                fontWeight: FontWeight.w800,
                letterSpacing: -1,
                height: 1.1,
              ),
            ),
            Text(
              _formatBusinessDate(businessDate),
              style: const TextStyle(color: _textMuted, fontSize: 11),
            ),

            const SizedBox(height: 20),

            // ── KPI Strip ────────────────────────────────────────────────────
            Row(
              children: [
                _KpiChip(
                  label: 'COVERS',
                  value: _fmt.format(summary.totalCovers),
                  icon: Icons.people_alt_rounded,
                  color: _sapphire,
                ),
                const SizedBox(width: 10),
                _KpiChip(
                  label: 'AVG CHECK',
                  value: _fmtAmt(summary.avgCheckPerCover),
                  icon: Icons.receipt_long_rounded,
                  color: _violet,
                ),
                const SizedBox(width: 10),
                _KpiChip(
                  label: 'ORDERS',
                  value: _fmt.format(summary.totalOrders),
                  icon: Icons.shopping_bag_rounded,
                  color: _gold,
                ),
              ],
            ),

            if (stackedTotal > 0) ...[
              const SizedBox(height: 20),

              // ── Revenue Mix Label ────────────────────────────────────────
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
                    if (foodPct > 0)
                      Expanded(
                        flex: (foodPct * 100).round(),
                        child: Container(height: 8, color: _emerald),
                      ),
                    if (bevPct > 0)
                      Expanded(
                        flex: (bevPct * 100).round(),
                        child: Container(height: 8, color: _sapphire),
                      ),
                    if (barPct > 0)
                      Expanded(
                        flex: (barPct * 100).round(),
                        child: Container(height: 8, color: _violet),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Legend
              Row(
                children: [
                  _MixLegend(color: _emerald,  label: 'Food',    value: _fmtAmt(summary.foodRevenue),      pct: foodPct),
                  const SizedBox(width: 16),
                  _MixLegend(color: _sapphire, label: 'Beverage', value: _fmtAmt(summary.beverageRevenue), pct: bevPct),
                  const SizedBox(width: 16),
                  _MixLegend(color: _violet,   label: 'Bar',     value: _fmtAmt(summary.barRevenue),       pct: barPct),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatBusinessDate(String d) {
    if (d.isEmpty) return '';
    try {
      return DateFormat('EEE, dd MMM yyyy').format(DateTime.parse(d));
    } catch (_) {
      return d;
    }
  }
}

class _KpiChip extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _KpiChip({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.18)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 14),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                color: _textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                color: _textMuted,
                fontSize: 9,
                letterSpacing: 0.8,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MixLegend extends StatelessWidget {
  final Color color;
  final String label;
  final String value;
  final double pct;

  const _MixLegend({
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
          width: 8, height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: _textMuted, fontSize: 9)),
            Text(
              '$value (${(pct * 100).toStringAsFixed(0)}%)',
              style: const TextStyle(
                color: _textSecondary,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

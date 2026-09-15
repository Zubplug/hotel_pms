import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _gold = Color(0xFFD4AF37);
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);
const _sapphire = Color(0xFF3B82F6);
const _violet = Color(0xFF8B5CF6);
const _textPrimary = Color(0xFFF8FAFC);
const _textMuted = Color(0xFF94A3B8);

/// 4-KPI scannable strip: Occupancy · ADR · RevPAR · TRevPAR
/// Each card shows value, label, and vs-yesterday trend badge.
class HeroKpiStrip extends StatelessWidget {
  final ExecutiveOverview overview;

  const HeroKpiStrip({super.key, required this.overview});

  @override
  Widget build(BuildContext context) {
    final kpis = [
      _KpiConfig(
        label: 'OCC',
        value: '${overview.occupancyPercent.toStringAsFixed(1)}%',
        trend: overview.occupancyTrend,
        accentColor: _sapphire,
        icon: Icons.hotel_rounded,
      ),
      _KpiConfig(
        label: 'ADR',
        value: _fmtCurrency(overview.adr),
        trend: overview.adrTrend,
        accentColor: _emerald,
        icon: Icons.bed_rounded,
      ),
      _KpiConfig(
        label: 'REVPAR',
        value: _fmtCurrency(overview.revpar),
        trend: overview.revparTrend,
        accentColor: _gold,
        icon: Icons.bar_chart_rounded,
        isUnaudited: true,
      ),
      _KpiConfig(
        label: 'TREVPAR',
        value: _fmtCurrency(overview.trevpar),
        trend: overview.totalRevenueTrend,
        accentColor: _violet,
        icon: Icons.auto_graph_rounded,
        isUnaudited: true,
      ),
    ];

    return Row(
      children: kpis
          .asMap()
          .entries
          .map((e) => Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    left: e.key == 0 ? 0 : 4,
                    right: e.key == kpis.length - 1 ? 0 : 4,
                  ),
                  child: _KpiCard(config: e.value),
                ),
              ))
          .toList(),
    );
  }

  String _fmtCurrency(double v) {
    if (v >= 1000000) return '\u20A6${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '\u20A6${(v / 1000).toStringAsFixed(1)}K';
    if (v <= 0) return '\u20A60';
    return '\u20A6${v.toStringAsFixed(0)}';
  }
}

class _KpiConfig {
  final String label;
  final String value;
  final double trend;
  final Color accentColor;
  final IconData icon;
  final bool isUnaudited;

  const _KpiConfig({
    required this.label,
    required this.value,
    required this.trend,
    required this.accentColor,
    required this.icon,
    this.isUnaudited = false,
  });
}

class _KpiCard extends StatelessWidget {
  final _KpiConfig config;

  const _KpiCard({required this.config});

  @override
  Widget build(BuildContext context) {
    final isPositive = config.trend > 0;
    final isNeutral = config.trend == 0;
    final trendColor = isPositive ? _emerald : _rose;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Accent icon
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: config.accentColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(config.icon, color: config.accentColor, size: 12),
          ),
          const SizedBox(height: 10),

          // Value — allow horizontal overflow by reducing font on overflow
          Text(
            config.isUnaudited ? '${config.value}*' : config.value,
            style: const TextStyle(
              color: _textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),

          // Label
          Text(
            config.label,
            style: const TextStyle(
              color: _textMuted,
              fontSize: 8,
              letterSpacing: 0.6,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),

          // Trend — compact: just arrow + number, no container wrapping
          if (!isNeutral)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isPositive
                      ? Icons.arrow_upward_rounded
                      : Icons.arrow_downward_rounded,
                  size: 9,
                  color: trendColor,
                ),
                const SizedBox(width: 1),
                Flexible(
                  child: Text(
                    '${config.trend.abs().toStringAsFixed(1)}%',
                    style: TextStyle(
                      color: trendColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            )
          else
            Text(
              '—',
              style: const TextStyle(color: _textMuted, fontSize: 10),
            ),
        ],
      ),
    );
  }
}

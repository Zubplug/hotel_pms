import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/fnb_dashboard_data.dart';

const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _sapphire = Color(0xFF3B82F6);
const _amber = Color(0xFFF59E0B);
const _gold = Color(0xFFD4AF37);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF64748B);

final _fmt = NumberFormat('#,##0', 'en');
final _fmtK = NumberFormat('#,##0.0', 'en');

String _fmtAmt(double v) {
  if (v >= 1000000) return '₦${_fmtK.format(v / 1000000)}M';
  if (v >= 1000) return '₦${_fmtK.format(v / 1000)}K';
  if (v <= 0) return '₦0';
  return '₦${v.toStringAsFixed(0)}';
}

/// Ranked list of top 5 selling items with podium highlight for #1
class FnbTopItems extends StatelessWidget {
  final List<FnbTopItem> items;

  const FnbTopItems({super.key, required this.items});

  Color _classColor(String cls) {
    switch (cls) {
      case 'BEVERAGE': return _sapphire;
      case 'OTHER':    return _amber;
      default:         return _emerald; // FOOD
    }
  }

  String _classLabel(String cls) {
    switch (cls) {
      case 'BEVERAGE': return 'BEV';
      case 'OTHER':    return 'OTH';
      default:         return 'FOOD';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _border),
        ),
        child: const Center(
          child: Text('No sales data today', style: TextStyle(color: _textMuted, fontSize: 13)),
        ),
      );
    }

    final maxRevenue = items.isEmpty ? 1.0 : items.map((i) => i.revenue).reduce((double a, double b) => a > b ? a : b);

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: items.asMap().entries.map((entry) {
          final rank = entry.key + 1;
          final item = entry.value;
          final isFirst = rank == 1;
          final barWidth = maxRevenue > 0 ? item.revenue / maxRevenue : 0.0;
          final color = _classColor(item.fnbClass);

          return Container(
            decoration: BoxDecoration(
              border: entry.key < items.length - 1
                  ? const Border(bottom: BorderSide(color: Color(0xFF1E3048), width: 0.5))
                  : null,
              borderRadius: isFirst
                  ? const BorderRadius.vertical(top: Radius.circular(16))
                  : null,
              color: isFirst ? _gold.withValues(alpha: 0.04) : Colors.transparent,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                // Rank badge
                SizedBox(
                  width: 28,
                  child: isFirst
                      ? const Icon(Icons.emoji_events_rounded, color: _gold, size: 18)
                      : Text(
                          '$rank',
                          style: TextStyle(
                            color: rank <= 3 ? _textSecondary : _textMuted,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                          textAlign: TextAlign.center,
                        ),
                ),
                const SizedBox(width: 10),

                // Name + bar + class chip
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.productName,
                              style: TextStyle(
                                color: _textPrimary,
                                fontSize: 13,
                                fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: color.withValues(alpha: 0.25)),
                            ),
                            child: Text(
                              _classLabel(item.fnbClass),
                              style: TextStyle(
                                color: color,
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      // Revenue bar
                      LayoutBuilder(
                        builder: (context, constraints) {
                          return Stack(
                            children: [
                              Container(
                                height: 3,
                                width: constraints.maxWidth,
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              Container(
                                height: 3,
                                width: constraints.maxWidth * barWidth,
                                decoration: BoxDecoration(
                                  color: color,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 12),

                // Stats column
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _fmtAmt(item.revenue),
                      style: TextStyle(
                        color: isFirst ? _gold : _textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${_fmt.format(item.qty)} sold',
                      style: const TextStyle(color: _textMuted, fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

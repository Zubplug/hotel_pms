import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/fnb_dashboard_data.dart';

const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _sapphire = Color(0xFF3B82F6);
const _violet = Color(0xFF8B5CF6);
const _gold = Color(0xFFD4AF37);
const _amber = Color(0xFFF59E0B);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF64748B);

final _fmtK = NumberFormat('#,##0.0', 'en');

String _fmtAmt(double v) {
  if (v >= 1000000) return '₦${_fmtK.format(v / 1000000)}M';
  if (v >= 1000) return '₦${_fmtK.format(v / 1000)}K';
  if (v <= 0) return '₦0';
  return '₦${v.toStringAsFixed(0)}';
}

/// Horizontally scrollable per-outlet performance cards
class FnbOutletCards extends StatelessWidget {
  final List<FnbOutlet> outlets;

  const FnbOutletCards({super.key, required this.outlets});

  Color _outletColor(int index) {
    final colors = [_emerald, _sapphire, _violet, _gold, _amber];
    return colors[index % colors.length];
  }

  IconData _outletIcon(String type) {
    switch (type.toLowerCase()) {
      case 'bar': return Icons.local_bar_rounded;
      case 'pool': return Icons.pool_rounded;
      case 'cafe': return Icons.local_cafe_rounded;
      case 'lounge': return Icons.weekend_rounded;
      default: return Icons.restaurant_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (outlets.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _border),
        ),
        child: const Center(
          child: Text('No outlet data today', style: TextStyle(color: _textMuted, fontSize: 13)),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 164,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: outlets.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final outlet = outlets[index];
              final color = _outletColor(index);
              return _OutletCard(outlet: outlet, color: color, icon: _outletIcon(outlet.outletType));
            },
          ),
        ),
      ],
    );
  }
}

class _OutletCard extends StatelessWidget {
  final FnbOutlet outlet;
  final Color color;
  final IconData icon;

  const _OutletCard({required this.outlet, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.06), blurRadius: 16, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon + outlet name
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 16),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  outlet.outletName,
                  style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const Spacer(),

          // Revenue
          Text(
            _fmtAmt(outlet.revenue),
            style: TextStyle(
              color: color,
              fontSize: 18,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text('Revenue', style: const TextStyle(color: _textMuted, fontSize: 10)),

          const SizedBox(height: 10),

          // Covers + Avg check row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${outlet.covers}', style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                    const Text('Covers', style: TextStyle(color: _textMuted, fontSize: 9)),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_fmtAmt(outlet.avgCheck), style: const TextStyle(color: _textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                    const Text('Avg Check', style: TextStyle(color: _textMuted, fontSize: 9)),
                  ],
                ),
              ),
            ],
          ),

          if (outlet.topItem != null) ...[
            const SizedBox(height: 8),
            const Divider(color: Color(0xFF1E3048), height: 1),
            const SizedBox(height: 8),
            Row(
              children: [
                Container(
                  width: 4, height: 4,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    outlet.topItem!.name,
                    style: const TextStyle(color: _textMuted, fontSize: 9),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

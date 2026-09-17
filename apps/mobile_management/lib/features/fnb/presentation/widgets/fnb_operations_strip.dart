import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/fnb_dashboard_data.dart';

const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _sapphire = Color(0xFF3B82F6);
const _rose = Color(0xFFF43F5E);
const _amber = Color(0xFFF59E0B);
const _textPrimary = Color(0xFFF8FAFC);
const _textMuted = Color(0xFF64748B);

final _fmtK = NumberFormat('#,##0.0', 'en');
String _fmtAmt(double v) {
  if (v >= 1000000) return '₦${_fmtK.format(v / 1000000)}M';
  if (v >= 1000) return '₦${_fmtK.format(v / 1000)}K';
  if (v <= 0) return '₦0';
  return '₦${v.toStringAsFixed(0)}';
}

/// Operational status strip: POS terminals, sessions, voids, discounts
class FnbOperationsStrip extends StatelessWidget {
  final FnbPosOperations ops;
  final FnbSummary summary;

  const FnbOperationsStrip({
    super.key,
    required this.ops,
    required this.summary,
  });

  @override
  Widget build(BuildContext context) {
    final terminalOk = ops.terminalsTotal == 0 || ops.terminalsOnline == ops.terminalsTotal;
    final terminalColor = terminalOk ? _emerald : _rose;
    final terminalIcon = terminalOk ? Icons.point_of_sale_rounded : Icons.warning_amber_rounded;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _OpCard(
                icon: terminalIcon,
                iconColor: terminalColor,
                label: 'POS Terminals',
                value: ops.terminalsTotal == 0
                    ? 'None'
                    : '${ops.terminalsOnline}/${ops.terminalsTotal}',
                subLabel: ops.terminalsTotal == 0
                    ? 'No terminals'
                    : ops.terminalsOnline == ops.terminalsTotal
                        ? 'All online'
                        : '${ops.terminalsTotal - ops.terminalsOnline} offline',
                subColor: terminalColor,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _OpCard(
                icon: Icons.store_rounded,
                iconColor: _sapphire,
                label: 'Active Sessions',
                value: '${ops.activeSessions}',
                subLabel: ops.activeSessions == 1 ? 'shift open' : 'shifts open',
                subColor: _sapphire,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _OpCard(
                icon: Icons.delete_outline_rounded,
                iconColor: ops.voids.count > 0 ? _rose : _textMuted,
                label: 'Voids',
                value: ops.voids.count > 0
                    ? '${ops.voids.count} items'
                    : 'None',
                subLabel: ops.voids.count > 0 ? _fmtAmt(ops.voids.amount) : 'Clean shift',
                subColor: ops.voids.count > 0 ? _rose : _emerald,
                note: ops.voids.count > 0
                    ? 'Item-count based void rate: ${summary.voidRate.toStringAsFixed(1)}%'
                    : null,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _OpCard(
                icon: Icons.local_offer_rounded,
                iconColor: ops.discounts.count > 0 ? _amber : _textMuted,
                label: 'Discounts',
                value: ops.discounts.count > 0
                    ? '${ops.discounts.count} applied'
                    : 'None',
                subLabel: ops.discounts.count > 0
                    ? '${summary.discountRate.toStringAsFixed(1)}% of gross'
                    : 'No discounts',
                subColor: ops.discounts.count > 0 ? _amber : _emerald,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _OpCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String subLabel;
  final Color subColor;
  final String? note;

  const _OpCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.subLabel,
    required this.subColor,
    this.note,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 16),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: _textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(
              color: _textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subLabel,
            style: TextStyle(
              color: subColor,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (note != null) ...[
            const SizedBox(height: 4),
            Text(
              note!,
              style: const TextStyle(color: _textMuted, fontSize: 9),
            ),
          ],
        ],
      ),
    );
  }
}

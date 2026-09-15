import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);
const _textMuted = Color(0xFF94A3B8);

/// Slim inline sync health pill row — minimal footprint at the bottom of the dashboard.
/// Only shows offline warning state prominently if offline > 0.
class SyncSummaryWidget extends StatelessWidget {
  final SyncSummary summary;

  const SyncSummaryWidget({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    final hasOffline = summary.offline > 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: hasOffline
            ? _rose.withValues(alpha: 0.06)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: hasOffline
            ? Border.all(color: _rose.withValues(alpha: 0.2))
            : Border.all(color: _border.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            hasOffline ? Icons.sync_problem_rounded : Icons.sync_rounded,
            size: 13,
            color: hasOffline ? _rose : _emerald,
          ),
          const SizedBox(width: 6),
          _SyncPill(
            count: summary.online,
            label: 'Online',
            color: _emerald,
          ),
          if (hasOffline) ...[
            const SizedBox(width: 4),
            Container(width: 1, height: 12, color: _border),
            const SizedBox(width: 4),
            _SyncPill(
              count: summary.offline,
              label: 'Offline',
              color: _rose,
            ),
          ],
          const Spacer(),
          Text(
            'SYNC',
            style: TextStyle(
              color: _textMuted.withValues(alpha: 0.5),
              fontSize: 8,
              letterSpacing: 1.0,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SyncPill extends StatelessWidget {
  final int count;
  final String label;
  final Color color;

  const _SyncPill({required this.count, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          '$count $label',
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

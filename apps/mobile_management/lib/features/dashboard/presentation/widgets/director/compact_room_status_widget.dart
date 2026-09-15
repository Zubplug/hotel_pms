import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _sapphire = Color(0xFF3B82F6);
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);
const _amber = Color(0xFFF59E0B);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);

/// Enhanced room status card with occupancy progress bar and premium styling.
class CompactRoomStatusWidget extends StatelessWidget {
  final RoomSummary summary;

  const CompactRoomStatusWidget({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    // Occupancy bar: occupied / (occupied + vacant + dirty) — excludes OOO
    final sellable = summary.occupied + summary.vacant + summary.dirty;
    final occupancyFraction = sellable > 0 ? summary.occupied / sellable : 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              const Text(
                'ROOM STATUS',
                style: TextStyle(
                  color: _textMuted,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              // X / Y rooms subtitle
              Text(
                '${summary.occupied} / ${sellable > 0 ? sellable : summary.total} rooms occupied',
                style: const TextStyle(
                  color: _textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Animated occupancy progress bar
          Stack(
            children: [
              // Background track
              Container(
                height: 6,
                decoration: BoxDecoration(
                  color: _border,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              // Filled bar
              FractionallySizedBox(
                widthFactor: occupancyFraction.clamp(0.0, 1.0),
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    gradient: LinearGradient(
                      colors: [
                        _sapphire,
                        occupancyFraction > 0.85 ? _emerald : _sapphire,
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${(occupancyFraction * 100).toStringAsFixed(0)}% occupancy',
            style: TextStyle(
              color: occupancyFraction > 0.8 ? _emerald : _textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),

          // Status cells
          Row(
            children: [
              Expanded(
                child: _StatusCell(
                  label: 'Occupied',
                  count: summary.occupied,
                  color: _sapphire,
                  subLabel: summary.occupiedDirty > 0
                      ? '${summary.occupiedDirty} dirty'
                      : null,
                  subLabelColor: _amber,
                ),
              ),
              _CellDivider(),
              Expanded(
                child: _StatusCell(
                  label: 'Vacant',
                  count: summary.vacant,
                  color: _emerald,
                ),
              ),
              _CellDivider(),
              Expanded(
                child: _StatusCell(
                  label: 'Dirty',
                  count: summary.dirty,
                  color: _amber,
                ),
              ),
              _CellDivider(),
              Expanded(
                child: _StatusCell(
                  label: 'OOO',
                  count: summary.ooo,
                  color: _rose,
                ),
              ),
            ],
          ),

          // Stayover dirty warning — only when occupiedDirty > 0
          if (summary.occupiedDirty > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: _amber.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _amber.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cleaning_services_rounded, size: 13, color: _amber),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${summary.occupiedDirty} occupied room${summary.occupiedDirty != 1 ? 's' : ''} '
                      'need housekeeping (stayover dirty)',
                      style: const TextStyle(
                        color: _amber,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CellDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        width: 1,
        height: 40,
        color: _border,
        margin: const EdgeInsets.symmetric(horizontal: 8),
      );
}

class _StatusCell extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final String? subLabel;
  final Color? subLabelColor;

  const _StatusCell({
    required this.label,
    required this.count,
    required this.color,
    this.subLabel,
    this.subLabelColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Count pill
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            count.toString(),
            style: TextStyle(
              color: color,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 5),
        Text(
          label,
          style: const TextStyle(
            color: _textMuted,
            fontSize: 10,
            letterSpacing: 0.5,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (subLabel != null) ...[
          const SizedBox(height: 2),
          Text(
            subLabel!,
            style: TextStyle(
              color: subLabelColor ?? _amber,
              fontSize: 9,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    );
  }
}

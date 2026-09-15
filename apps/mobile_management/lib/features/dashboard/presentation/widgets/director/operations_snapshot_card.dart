import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _surface = Color(0xFF111827);
const _surfaceElevated = Color(0xFF1A2535);
const _border = Color(0xFF1E3048);
const _gold = Color(0xFFD4AF37);
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);
const _sapphire = Color(0xFF3B82F6);
const _amber = Color(0xFFF59E0B);
const _violet = Color(0xFF8B5CF6);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);

/// Premium operations snapshot: Arrivals · Departures · In-House (primary row)
/// + VIP Arrivals · OOO Rooms (secondary row).
class OperationsSnapshotCard extends StatelessWidget {
  final TodaySnapshot snapshot;
  final RoomSummary roomSummary;

  const OperationsSnapshotCard({
    super.key,
    required this.snapshot,
    required this.roomSummary,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                const Text(
                  'OPERATIONS TODAY',
                  style: TextStyle(
                    color: _textMuted,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                // Live indicator
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _emerald.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _emerald.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: _emerald,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        'LIVE',
                        style: TextStyle(
                          color: _emerald,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Primary metrics row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: _PrimaryMetric(
                    label: 'ARRIVALS',
                    value: snapshot.arrivals.toString(),
                    icon: Icons.login_rounded,
                    color: _emerald,
                  ),
                ),
                _VerticalDivider(),
                Expanded(
                  child: _PrimaryMetric(
                    label: 'DEPARTURES',
                    value: snapshot.departures.toString(),
                    icon: Icons.logout_rounded,
                    color: _amber,
                  ),
                ),
                _VerticalDivider(),
                Expanded(
                  child: _PrimaryMetric(
                    label: 'IN-HOUSE',
                    value: snapshot.inHouseGuests.toString(),
                    icon: Icons.people_alt_rounded,
                    color: _sapphire,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Divider
          Divider(color: _border, height: 1),

          // Secondary metrics row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Row(
              children: [
                // VIP Arrivals — highlighted gold if > 0
                Expanded(
                  child: _SecondaryMetric(
                    label: 'VIP ARRIVALS',
                    value: snapshot.vipArrivals.toString(),
                    icon: Icons.star_rounded,
                    color: snapshot.vipArrivals > 0 ? _gold : _textMuted,
                    highlighted: snapshot.vipArrivals > 0,
                  ),
                ),
                _VerticalDivider(height: 30),
                // OOO Rooms
                Expanded(
                  child: _SecondaryMetric(
                    label: 'OUT OF ORDER',
                    value: roomSummary.ooo.toString(),
                    icon: Icons.do_not_disturb_on_rounded,
                    color: roomSummary.ooo > 0 ? _rose : _textMuted,
                    highlighted: false,
                  ),
                ),
                _VerticalDivider(height: 30),
                // Total Rooms
                Expanded(
                  child: _SecondaryMetric(
                    label: 'TOTAL ROOMS',
                    value: roomSummary.total > 0
                        ? roomSummary.total.toString()
                        : snapshot.availableRooms.toString(),
                    icon: Icons.apartment_rounded,
                    color: _textMuted,
                    highlighted: false,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VerticalDivider extends StatelessWidget {
  final double height;
  const _VerticalDivider({this.height = 48});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: height,
      color: _border,
      margin: const EdgeInsets.symmetric(horizontal: 8),
    );
  }
}

class _PrimaryMetric extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _PrimaryMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(height: 10),
        Text(
          value,
          style: const TextStyle(
            color: _textPrimary,
            fontSize: 24,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(
            color: _textMuted,
            fontSize: 9,
            letterSpacing: 0.8,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _SecondaryMetric extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool highlighted;

  const _SecondaryMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.highlighted,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: highlighted ? const EdgeInsets.symmetric(vertical: 4, horizontal: 8) : EdgeInsets.zero,
      decoration: highlighted
          ? BoxDecoration(
              color: _gold.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _gold.withValues(alpha: 0.2)),
            )
          : null,
      child: Column(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 5),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: _textMuted,
              fontSize: 9,
              letterSpacing: 0.6,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

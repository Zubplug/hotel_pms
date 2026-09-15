import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _rose = Color(0xFFF43F5E);
const _amber = Color(0xFFF59E0B);
const _gold = Color(0xFFD4AF37);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);

/// Priority-aware alerts card with P0/P1/P2 visual hierarchy,
/// animated P0 indicator, and tappable action chips.
class AlertsIntelCard extends StatefulWidget {
  final List<AlertData> alerts;
  final void Function(String action) onActionTap;

  const AlertsIntelCard({
    super.key,
    required this.alerts,
    required this.onActionTap,
  });

  @override
  State<AlertsIntelCard> createState() => _AlertsIntelCardState();
}

class _AlertsIntelCardState extends State<AlertsIntelCard>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.alerts.isEmpty) return const SizedBox.shrink();

    final hasP0 = widget.alerts.any((a) => a.priority == 'P0');
    final criticalCount = widget.alerts.where((a) => a.priority == 'P0').length;
    final displayAlerts = _expanded ? widget.alerts : widget.alerts.take(3).toList();
    final hasMore = widget.alerts.length > 3;

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasP0
              ? _rose.withValues(alpha: 0.4)
              : _amber.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: hasP0
                  ? _rose.withValues(alpha: 0.08)
                  : _amber.withValues(alpha: 0.06),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: Row(
              children: [
                // Pulsing P0 dot or static icon
                if (hasP0)
                  AnimatedBuilder(
                    animation: _pulseAnimation,
                    builder: (_, __) => Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: _rose.withValues(alpha: _pulseAnimation.value),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: _rose.withValues(alpha: 0.4 * _pulseAnimation.value),
                            blurRadius: 6,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  const Icon(Icons.warning_amber_rounded, color: _amber, size: 16),
                const SizedBox(width: 10),
                Text(
                  'REQUIRES ATTENTION',
                  style: TextStyle(
                    color: hasP0 ? _rose : _amber,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                const Spacer(),
                // Count badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: hasP0
                        ? _rose.withValues(alpha: 0.15)
                        : _amber.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${widget.alerts.length}',
                    style: TextStyle(
                      color: hasP0 ? _rose : _amber,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Alert items
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 8, 0, 4),
            child: Column(
              children: displayAlerts.map((alert) => _AlertRow(
                alert: alert,
                onActionTap: widget.onActionTap,
              )).toList(),
            ),
          ),

          // Expand / collapse button
          if (hasMore)
            InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: _border)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _expanded
                          ? 'Show fewer'
                          : 'Show all (${widget.alerts.length})',
                      style: const TextStyle(
                        color: _textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: _textMuted,
                      size: 16,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  final AlertData alert;
  final void Function(String action) onActionTap;

  const _AlertRow({required this.alert, required this.onActionTap});

  Color get _priorityColor {
    switch (alert.priority) {
      case 'P0':
        return _rose;
      case 'P1':
        return _amber;
      case 'P2':
        return _gold;
      default:
        return _textMuted;
    }
  }

  String get _actionLabel {
    switch (alert.action) {
      case 'VIEW_APPROVALS':
        return 'Approvals →';
      case 'VIEW_FINANCE':
        return 'Finance →';
      case 'VIEW_MAINTENANCE':
        return 'Rooms →';
      default:
        return 'View →';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _priorityColor.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(color: _priorityColor, width: 3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Priority badge + title
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: _priorityColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        alert.priority,
                        style: TextStyle(
                          color: _priorityColor,
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        alert.title,
                        style: const TextStyle(
                          color: _textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  alert.summary,
                  style: const TextStyle(
                    color: _textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Action chip
          if (alert.action.isNotEmpty)
            GestureDetector(
              onTap: () => onActionTap(alert.action),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _priorityColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _priorityColor.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _actionLabel,
                  style: TextStyle(
                    color: _priorityColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

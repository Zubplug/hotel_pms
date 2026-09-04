import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/auditor_dashboard_data.dart';

class NightAuditStatusWidget extends StatelessWidget {
  final AuditStatus status;
  final String businessDate;
  final NightAuditAnalytics analytics;

  const NightAuditStatusWidget({
    super.key,
    required this.status,
    required this.businessDate,
    required this.analytics,
  });

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const surfaceDeep = Color(0xFF0F172A);
    const textPrimary = Color(0xFFF8FAFC);
    const textSecondary = Color(0xFF94A3B8);
    const goldAccent = Color(0xFFD4AF37);

    final statusConfig = _getStatusConfig(status.state);
    final currencyFmt = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final dateFmt = _formatBusinessDate(businessDate);

    return Container(
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusConfig.color.withValues(alpha: 0.18)),
      ),
      child: Column(
        children: [
          // ── Header ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'NIGHT AUDIT STATUS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                    color: textSecondary,
                  ),
                ),
                _StatusBadge(config: statusConfig),
              ],
            ),
          ),

          // ── Business Date + Occupancy ────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Business Date',
                        style: TextStyle(fontSize: 11, color: textSecondary, letterSpacing: 0.4),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        dateFmt,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: textPrimary,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                // Occupancy pill
                if (analytics.totalRooms > 0)
                  _OccupancyPill(analytics: analytics),
              ],
            ),
          ),

          // ── Progress bar (only when active) ─────────────────────
          if (status.state == 'IN_PROGRESS' || status.state == 'POSTING') ...[
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: status.progressPercent / 100,
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                      color: goldAccent,
                      minHeight: 5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        status.currentStep.isNotEmpty
                            ? 'Step: ${_humanStep(status.currentStep)}'
                            : 'Running…',
                        style: TextStyle(fontSize: 11, color: textSecondary),
                      ),
                      Text(
                        '${status.progressPercent.toInt()}%',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: goldAccent,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],

          // ── Divider ─────────────────────────────────────────────
          const SizedBox(height: 16),
          Divider(height: 1, color: Colors.white.withValues(alpha: 0.06)),

          // ── KPI Row: Revenue · Payments · Guests ────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Row(
              children: [
                _KpiTile(
                  label: 'Revenue',
                  value: currencyFmt.format(analytics.revenue),
                  icon: Icons.trending_up_rounded,
                  color: Colors.greenAccent,
                ),
                _dividerLine(),
                _KpiTile(
                  label: 'Payments',
                  value: currencyFmt.format(analytics.payments),
                  icon: Icons.payments_outlined,
                  color: const Color(0xFF60A5FA),
                ),
                _dividerLine(),
                _KpiTile(
                  label: 'In-House',
                  value: analytics.inHouseGuests.toString(),
                  icon: Icons.people_alt_outlined,
                  color: const Color(0xFFA78BFA),
                ),
              ],
            ),
          ),

          // ── Room Stats Row ───────────────────────────────────────
          if (analytics.totalRooms > 0) ...[
            Divider(height: 1, color: Colors.white.withValues(alpha: 0.06)),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
              child: Row(
                children: [
                  _RoomStat(
                    count: analytics.occupiedRooms,
                    label: 'Occupied',
                    color: goldAccent,
                    surfaceDeep: surfaceDeep,
                  ),
                  const SizedBox(width: 8),
                  _RoomStat(
                    count: analytics.availableRooms,
                    label: 'Available',
                    color: Colors.greenAccent,
                    surfaceDeep: surfaceDeep,
                  ),
                  const SizedBox(width: 8),
                  _RoomStat(
                    count: analytics.outOfOrderRooms,
                    label: 'Out of Order',
                    color: Colors.redAccent,
                    surfaceDeep: surfaceDeep,
                  ),
                  const SizedBox(width: 8),
                  _RoomStat(
                    count: analytics.totalRooms,
                    label: 'Total',
                    color: textSecondary,
                    surfaceDeep: surfaceDeep,
                  ),
                ],
              ),
            ),
          ],

          // ── Audit Timeline Footer ────────────────────────────────
          _AuditTimeline(status: status, statusConfig: statusConfig),
        ],
      ),
    );
  }

  Widget _dividerLine() => Container(
        width: 1,
        height: 36,
        color: Colors.white.withValues(alpha: 0.07),
        margin: const EdgeInsets.symmetric(horizontal: 12),
      );

  String _formatBusinessDate(String raw) {
    // Try full ISO string first (e.g. '2026-09-04T00:00:00.000Z')
    if (raw.isNotEmpty) {
      try {
        // For @db.Date fields Prisma returns 'YYYY-MM-DD'.
        // For fallback Date objects JS sends 'YYYY-MM-DDTHH:mm:ss.sssZ'.
        // We always want just the date portion, so extract the first 10 chars
        // to avoid timezone shifts when calling .toLocal().
        final datePart = raw.length >= 10 ? raw.substring(0, 10) : raw;
        final dt = DateTime.parse(datePart); // UTC midnight
        return DateFormat('EEE, MMM d yyyy').format(dt);
      } catch (_) {
        // fall through to today
      }
    }
    // Fallback: show today's date
    return DateFormat('EEE, MMM d yyyy').format(DateTime.now());
  }

  String _humanStep(String step) {
    return step
        .split('_')
        .map((s) => s.isEmpty ? '' : '${s[0].toUpperCase()}${s.substring(1).toLowerCase()}')
        .join(' ');
  }

  _StatusConfig _getStatusConfig(String state) {
    switch (state) {
      case 'COMPLETED':
        return _StatusConfig('Completed', Icons.check_circle_outline_rounded, Colors.greenAccent);
      case 'IN_PROGRESS':
        return _StatusConfig('In Progress', Icons.sync_rounded, Colors.orangeAccent);
      case 'POSTING':
        return _StatusConfig('Posting', Icons.cloud_upload_outlined, Colors.amberAccent);
      case 'FAILED':
        return _StatusConfig('Failed', Icons.error_outline_rounded, Colors.redAccent);
      case 'OVERDUE':
        return _StatusConfig('Overdue', Icons.warning_amber_rounded, Colors.redAccent);
      default:
        return _StatusConfig('Pending', Icons.schedule_rounded, const Color(0xFF94A3B8));
    }
  }
}

// ── Sub-widgets ──────────────────────────────────────────────────────────────

class _StatusConfig {
  final String label;
  final IconData icon;
  final Color color;
  const _StatusConfig(this.label, this.icon, this.color);
}

class _StatusBadge extends StatelessWidget {
  final _StatusConfig config;
  const _StatusBadge({required this.config});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: config.color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: config.color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(config.icon, size: 13, color: config.color),
          const SizedBox(width: 5),
          Text(
            config.label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: config.color,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _OccupancyPill extends StatelessWidget {
  final NightAuditAnalytics analytics;
  const _OccupancyPill({required this.analytics});

  @override
  Widget build(BuildContext context) {
    final pct = analytics.occupancyPercent;
    final color = pct >= 80
        ? Colors.greenAccent
        : pct >= 50
            ? Colors.amberAccent
            : Colors.redAccent;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.hotel_rounded, size: 13, color: color),
          const SizedBox(width: 5),
          Text(
            '${pct.toStringAsFixed(0)}% Occ.',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _KpiTile({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    const textSecondary = Color(0xFF94A3B8);
    const textPrimary = Color(0xFFF8FAFC);

    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(fontSize: 10, color: textSecondary, letterSpacing: 0.3),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: textPrimary,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _RoomStat extends StatelessWidget {
  final int count;
  final String label;
  final Color color;
  final Color surfaceDeep;
  const _RoomStat({required this.count, required this.label, required this.color, required this.surfaceDeep});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Text(
              count.toString(),
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                color: color.withValues(alpha: 0.7),
                fontWeight: FontWeight.w600,
                letterSpacing: 0.2,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _AuditTimeline extends StatelessWidget {
  final AuditStatus status;
  final _StatusConfig statusConfig;
  const _AuditTimeline({required this.status, required this.statusConfig});

  @override
  Widget build(BuildContext context) {
    const textSecondary = Color(0xFF94A3B8);
    const textPrimary = Color(0xFFF8FAFC);
    const surfaceDeep = Color(0xFF0F172A);

    // Determine step states
    final bool isStarted = status.startedAt != null;
    final bool isProcessing =
        status.state == 'IN_PROGRESS' || status.state == 'POSTING';
    final bool isCompleted = status.state == 'COMPLETED';

    final steps = [
      _TimelineStep(
        label: 'Audit Started',
        detail: isStarted
            ? DateFormat('h:mm a').format(status.startedAt!)
            : 'Not yet started',
        isDone: isStarted && !isProcessing && !isCompleted,
        isActive: isStarted,
        isCurrent: false,
        statusColor: statusConfig.color,
      ),
      _TimelineStep(
        label: status.state == 'POSTING' ? 'Posting' : 'Processing',
        detail: isProcessing
            ? '${status.progressPercent.toInt()}% complete'
            : (isCompleted ? 'Done' : 'Waiting'),
        isDone: isCompleted,
        isActive: isProcessing,
        isCurrent: isProcessing,
        statusColor: statusConfig.color,
      ),
      _TimelineStep(
        label: 'Completed',
        detail: status.completedAt != null
            ? DateFormat('h:mm a').format(status.completedAt!)
            : 'Pending',
        isDone: isCompleted,
        isActive: isCompleted,
        isCurrent: false,
        statusColor: Colors.greenAccent,
      ),
    ];

    // Footer note
    String? footerNote;
    IconData footerIcon = Icons.history_rounded;
    Color footerColor = textSecondary;
    if (status.state == 'OVERDUE') {
      footerNote = 'Audit is overdue — action required';
      footerIcon = Icons.warning_amber_rounded;
      footerColor = Colors.redAccent;
    } else if (status.state == 'FAILED') {
      footerNote = 'Previous audit failed — retry needed';
      footerIcon = Icons.error_outline_rounded;
      footerColor = Colors.redAccent;
    } else if (status.lastSuccessfulAudit != null &&
        status.state != 'COMPLETED') {
      footerNote =
          'Last successful: ${DateFormat('MMM d, h:mm a').format(status.lastSuccessfulAudit!)}';
    }

    return Container(
      decoration: BoxDecoration(
        color: surfaceDeep,
        borderRadius:
            const BorderRadius.vertical(bottom: Radius.circular(16)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section label
          Text(
            'AUDIT PROGRESS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: textSecondary.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 12),

          // Vertical steps
          ...steps.asMap().entries.map((e) {
            final idx = e.key;
            final step = e.value;
            final isLast = idx == steps.length - 1;
            return _buildStep(step, isLast, textSecondary, textPrimary);
          }),

          // Footer note
          if (footerNote != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: footerColor.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: footerColor.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Icon(footerIcon, size: 12, color: footerColor),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      footerNote,
                      style: TextStyle(
                        fontSize: 11,
                        color: footerColor,
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

  Widget _buildStep(
    _TimelineStep step,
    bool isLast,
    Color textSecondary,
    Color textPrimary,
  ) {
    final dotColor = step.isActive
        ? step.statusColor
        : Colors.white.withValues(alpha: 0.15);
    final labelColor = step.isActive ? step.statusColor : textSecondary;
    final detailColor = step.isActive
        ? textPrimary
        : textSecondary.withValues(alpha: 0.5);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Dot + connector line column
          SizedBox(
            width: 20,
            child: Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: step.isActive
                        ? step.statusColor.withValues(alpha: 0.2)
                        : Colors.transparent,
                    border: Border.all(
                      color: dotColor,
                      width: step.isActive ? 2 : 1.5,
                    ),
                  ),
                  child: step.isDone || (step.isActive && !step.isCurrent)
                      ? Center(
                          child: Container(
                            width: 4,
                            height: 4,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: step.statusColor,
                            ),
                          ),
                        )
                      : null,
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1.5,
                      margin: const EdgeInsets.symmetric(vertical: 2),
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Label + detail
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    step.label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: labelColor,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    step.detail,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: detailColor,
                    ),
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

class _TimelineStep {
  final String label;
  final String detail;
  final bool isDone;
  final bool isActive;
  final bool isCurrent;
  final Color statusColor;

  const _TimelineStep({
    required this.label,
    required this.detail,
    required this.isDone,
    required this.isActive,
    required this.isCurrent,
    required this.statusColor,
  });
}


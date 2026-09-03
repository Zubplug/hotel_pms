import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/auditor_dashboard_data.dart';

class NightAuditStatusWidget extends StatelessWidget {
  final AuditStatus status;
  final String businessDate;

  const NightAuditStatusWidget({
    super.key,
    required this.status,
    required this.businessDate,
  });

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const textPrimary = Color(0xFFF8FAFC);
    const textSecondary = Color(0xFF94A3B8);
    const goldAccent = Color(0xFFD4AF37);

    Color statusColor;
    String statusText;
    IconData statusIcon;

    switch (status.state) {
      case 'COMPLETED':
        statusColor = Colors.greenAccent;
        statusText = 'Audit Completed';
        statusIcon = Icons.check_circle_outline;
        break;
      case 'IN_PROGRESS':
      case 'POSTING':
        statusColor = Colors.orangeAccent;
        statusText = 'Audit In Progress';
        statusIcon = Icons.sync;
        break;
      case 'FAILED':
        statusColor = Colors.redAccent;
        statusText = 'Audit Failed';
        statusIcon = Icons.error_outline;
        break;
      case 'OVERDUE':
        statusColor = Colors.redAccent;
        statusText = 'Audit Overdue';
        statusIcon = Icons.warning_amber_rounded;
        break;
      default:
        statusColor = textSecondary;
        statusText = 'Audit Pending';
        statusIcon = Icons.schedule;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'NIGHT AUDIT STATUS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: textSecondary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(statusIcon, size: 14, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Business Date',
                      style: TextStyle(fontSize: 12, color: textSecondary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      businessDate,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (status.state == 'IN_PROGRESS' || status.state == 'POSTING') ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: status.progressPercent / 100,
                backgroundColor: Colors.black26,
                color: goldAccent,
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Current Step: ${status.currentStep}',
                  style: TextStyle(fontSize: 12, color: textSecondary),
                ),
                Text(
                  '${status.progressPercent.toInt()}%',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: goldAccent),
                ),
              ],
            ),
          ] else if (status.state == 'COMPLETED' && status.completedAt != null) ...[
            Text(
              'Completed at: ${DateFormat('MMM d, h:mm a').format(status.completedAt!)}',
              style: TextStyle(fontSize: 12, color: textSecondary),
            ),
          ] else if (status.lastSuccessfulAudit != null) ...[
            Text(
              'Last Audit: ${DateFormat('MMM d, h:mm a').format(status.lastSuccessfulAudit!)}',
              style: TextStyle(fontSize: 12, color: textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

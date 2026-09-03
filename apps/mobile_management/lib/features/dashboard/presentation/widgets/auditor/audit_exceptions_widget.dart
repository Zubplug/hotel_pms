import 'package:flutter/material.dart';
import '../../models/auditor_dashboard_data.dart';

class AuditExceptionsWidget extends StatelessWidget {
  final AuditExceptions exceptions;

  const AuditExceptionsWidget({
    super.key,
    required this.exceptions,
  });

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const textSecondary = Color(0xFF94A3B8);

    final bool isReady = exceptions.criticalCount == 0 && exceptions.warningCount == 0;
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isReady 
              ? Colors.green.withValues(alpha: 0.3) 
              : (exceptions.criticalCount > 0 ? Colors.red.withValues(alpha: 0.3) : Colors.orange.withValues(alpha: 0.3)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isReady ? Icons.check_circle : (exceptions.criticalCount > 0 ? Icons.error : Icons.warning),
                color: isReady ? Colors.greenAccent : (exceptions.criticalCount > 0 ? Colors.redAccent : Colors.orangeAccent),
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                'AUDIT EXCEPTIONS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (isReady)
            const Text(
              'Audit Ready',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.greenAccent,
              ),
            )
          else
            Row(
              children: [
                if (exceptions.criticalCount > 0) ...[
                  _buildExceptionBadge(exceptions.criticalCount.toString(), 'Critical', Colors.redAccent, Icons.cancel),
                  const SizedBox(width: 16),
                ],
                if (exceptions.warningCount > 0)
                  _buildExceptionBadge(exceptions.warningCount.toString(), 'Warnings', Colors.orangeAccent, Icons.info),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildExceptionBadge(String count, String label, Color color, IconData icon) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              count,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: color.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

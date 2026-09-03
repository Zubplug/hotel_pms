import 'package:flutter/material.dart';
import '../../models/auditor_dashboard_data.dart';

class DiscrepancyListWidget extends StatelessWidget {
  final CriticalDiscrepancies discrepancies;

  const DiscrepancyListWidget({
    super.key,
    required this.discrepancies,
  });

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const textPrimary = Color(0xFFF8FAFC);
    const textSecondary = Color(0xFF94A3B8);

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
                'CRITICAL DISCREPANCIES',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: textSecondary,
                ),
              ),
              Icon(Icons.rule_rounded, color: textSecondary, size: 16),
            ],
          ),
          const SizedBox(height: 16),
          _buildItem(
            'Room Status Discrepancies',
            discrepancies.roomStatusDiscrepancies,
            Icons.bed_outlined,
            textPrimary,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'Occupancy Discrepancies',
            discrepancies.occupancyDiscrepancies,
            Icons.group_outlined,
            textPrimary,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'Unposted Charges',
            discrepancies.unpostedCharges,
            Icons.receipt_long_outlined,
            textPrimary,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'Open Folios',
            discrepancies.openFolios,
            Icons.folder_open_outlined,
            textPrimary,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'Reservations Requiring Attention',
            discrepancies.reservationsRequiringAttention,
            Icons.warning_amber_rounded,
            textPrimary,
          ),
        ],
      ),
    );
  }

  Widget _buildItem(String label, int count, IconData icon, Color textColor) {
    final hasIssues = count > 0;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: hasIssues ? Colors.redAccent.withValues(alpha: 0.1) : Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            icon,
            size: 20,
            color: hasIssues ? Colors.redAccent : Colors.white54,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: textColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        if (hasIssues)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.redAccent,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              count.toString(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          )
        else
          Text(
            '0',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.3),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
      ],
    );
  }
}

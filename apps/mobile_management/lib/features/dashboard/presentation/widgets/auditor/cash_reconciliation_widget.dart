import 'package:flutter/material.dart';
import '../../models/auditor_dashboard_data.dart';
import 'package:intl/intl.dart';

class CashReconciliationWidget extends StatelessWidget {
  final CashReconciliation reconciliation;

  const CashReconciliationWidget({
    super.key,
    required this.reconciliation,
  });

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const textSecondary = Color(0xFF94A3B8);

    final currencyFormat = NumberFormat.currency(symbol: '\$');

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
                'CASH & SHIFT RECONCILIATION',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: textSecondary,
                ),
              ),
              Icon(Icons.point_of_sale_rounded, color: textSecondary, size: 16),
            ],
          ),
          const SizedBox(height: 16),
          _buildItem(
            'Open Front Desk Shifts',
            reconciliation.openShifts.toString(),
            Icons.desktop_windows_outlined,
            reconciliation.openShifts > 0,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'Pending Cash Handovers',
            reconciliation.pendingHandovers.toString(),
            Icons.payments_outlined,
            reconciliation.pendingHandovers > 0,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'Unreconciled Cash',
            currencyFormat.format(reconciliation.unreconciledCash),
            Icons.money_off_outlined,
            reconciliation.unreconciledCash > 0,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'POS Sessions Requiring Closure',
            reconciliation.posSessionsRequiringClosure.toString(),
            Icons.storefront_outlined,
            reconciliation.posSessionsRequiringClosure > 0,
          ),
          const Divider(color: Colors.white10, height: 24),
          _buildItem(
            'Outstanding Deposits',
            reconciliation.outstandingDeposits.toString(),
            Icons.account_balance_outlined,
            reconciliation.outstandingDeposits > 0,
            isWarning: true,
          ),
        ],
      ),
    );
  }

  Widget _buildItem(String label, String value, IconData icon, bool hasIssues, {bool isWarning = false}) {
    final issueColor = isWarning ? Colors.orangeAccent : Colors.redAccent;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: hasIssues ? issueColor.withValues(alpha: 0.1) : Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            icon,
            size: 20,
            color: hasIssues ? issueColor : Colors.white54,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: Color(0xFFF8FAFC),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        if (hasIssues)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: issueColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          )
        else
          Text(
            value,
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

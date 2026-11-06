import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/auditor_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const _surface  = Color(0xFF0C1828);
const _border   = Color(0xFF1A2D47);
const _text     = Color(0xFFF0F5FF);
const _textSub  = Color(0xFF8FA3BF);
const _textDim  = Color(0xFF4D6480);
const _amber    = Color(0xFFF59E0B);
const _rose     = Color(0xFFF43F5E);

class CashReconciliationWidget extends StatelessWidget {
  final CashReconciliation reconciliation;

  const CashReconciliationWidget({super.key, required this.reconciliation});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    final items = [
      _RecItem(
        label: 'Open Front Desk Shifts',
        value: reconciliation.openShifts.toString(),
        icon: Icons.desktop_windows_outlined,
        hasIssue: reconciliation.openShifts > 0,
        isWarning: false,
      ),
      _RecItem(
        label: 'Pending Cash Handovers',
        value: reconciliation.pendingHandovers.toString(),
        icon: Icons.payments_outlined,
        hasIssue: reconciliation.pendingHandovers > 0,
        isWarning: false,
      ),
      _RecItem(
        label: 'Unreconciled Cash',
        value: fmt.format(reconciliation.unreconciledCash),
        icon: Icons.money_off_outlined,
        hasIssue: reconciliation.unreconciledCash > 0,
        isWarning: false,
      ),
      _RecItem(
        label: 'POS Sessions to Close',
        value: reconciliation.posSessionsRequiringClosure.toString(),
        icon: Icons.storefront_outlined,
        hasIssue: reconciliation.posSessionsRequiringClosure > 0,
        isWarning: false,
      ),
      _RecItem(
        label: 'Outstanding Deposits',
        value: reconciliation.outstandingDeposits.toString(),
        icon: Icons.account_balance_outlined,
        hasIssue: reconciliation.outstandingDeposits > 0,
        isWarning: true,
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: _amber.withValues(alpha: .10),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: const Icon(Icons.point_of_sale_rounded, color: _amber, size: 16),
              ),
              const SizedBox(width: 10),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CASH & SHIFT RECONCILIATION',
                    style: TextStyle(
                      color: _text,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Open positions before audit close',
                    style: TextStyle(color: _textDim, fontSize: 10),
                  ),
                ],
              ),
            ]),
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: _border),
          // ── Rows ────────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: items.map((it) => _RecRow(item: it)).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Data Model ───────────────────────────────────────────────────────────────
class _RecItem {
  final String label;
  final String value;
  final IconData icon;
  final bool hasIssue;
  final bool isWarning;
  const _RecItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.hasIssue,
    required this.isWarning,
  });
}

// ─── Single Row ───────────────────────────────────────────────────────────────
class _RecRow extends StatelessWidget {
  final _RecItem item;
  const _RecRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final issueColor = item.isWarning ? _amber : _rose;
    final activeColor = item.hasIssue ? issueColor : _textDim;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: item.hasIssue
                ? issueColor.withValues(alpha: .10)
                : _border.withValues(alpha: .5),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(item.icon, color: activeColor, size: 17),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            item.label,
            style: TextStyle(
              color: item.hasIssue ? _text : _textSub,
              fontSize: 12,
              fontWeight: item.hasIssue ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
        if (item.hasIssue)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: issueColor.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: issueColor.withValues(alpha: .3)),
            ),
            child: Text(
              item.value,
              style: TextStyle(
                color: issueColor,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          )
        else
          Text(
            item.value,
            style: const TextStyle(color: _textDim, fontSize: 12, fontWeight: FontWeight.w500),
          ),
      ]),
    );
  }
}

import 'package:flutter/material.dart';
import '../../models/auditor_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const _surface  = Color(0xFF0C1828);
const _border   = Color(0xFF1A2D47);
const _text     = Color(0xFFF0F5FF);
const _textSub  = Color(0xFF8FA3BF);
const _textDim  = Color(0xFF4D6480);
const _rose     = Color(0xFFF43F5E);

class DiscrepancyListWidget extends StatelessWidget {
  final CriticalDiscrepancies discrepancies;

  const DiscrepancyListWidget({
    super.key,
    required this.discrepancies,
  });

  @override
  Widget build(BuildContext context) {
    final items = [
      _Item('Room Status Discrepancies',      discrepancies.roomStatusDiscrepancies,         Icons.bed_outlined),
      _Item('Occupancy Discrepancies',         discrepancies.occupancyDiscrepancies,          Icons.group_outlined),
      _Item('Unposted Charges',               discrepancies.unpostedCharges,                 Icons.receipt_long_outlined),
      _Item('Open Folios',                    discrepancies.openFolios,                      Icons.folder_open_outlined),
      _Item('Reservations Requiring Attention', discrepancies.reservationsRequiringAttention, Icons.warning_amber_rounded),
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
                  color: _rose.withValues(alpha: .10),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: const Icon(Icons.rule_rounded, color: _rose, size: 16),
              ),
              const SizedBox(width: 10),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CRITICAL DISCREPANCIES',
                    style: TextStyle(
                      color: _text,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Room, occupancy and folio checks',
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
              children: items.map((it) => _DiscRow(item: it)).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Data Model ───────────────────────────────────────────────────────────────
class _Item {
  final String label;
  final int count;
  final IconData icon;
  const _Item(this.label, this.count, this.icon);
}

// ─── Single Row ───────────────────────────────────────────────────────────────
class _DiscRow extends StatelessWidget {
  final _Item item;
  const _DiscRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final hasIssue = item.count > 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: hasIssue
                ? _rose.withValues(alpha: .10)
                : _border.withValues(alpha: .5),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(item.icon,
              color: hasIssue ? _rose : _textDim, size: 17),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            item.label,
            style: TextStyle(
              color: hasIssue ? _text : _textSub,
              fontSize: 12,
              fontWeight: hasIssue ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
        Container(
          constraints: const BoxConstraints(minWidth: 32),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: hasIssue
              ? BoxDecoration(
                  color: _rose.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _rose.withValues(alpha: .3)),
                )
              : null,
          child: Text(
            '${item.count}',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: hasIssue ? _rose : _textDim,
              fontSize: 12,
              fontWeight: hasIssue ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
        ),
      ]),
    );
  }
}

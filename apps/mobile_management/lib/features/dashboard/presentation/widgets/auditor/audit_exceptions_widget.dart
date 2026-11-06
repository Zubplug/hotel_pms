import 'package:flutter/material.dart';
import '../../models/auditor_dashboard_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _bg       = Color(0xFF060C17);
const _surface  = Color(0xFF0C1828);
const _border   = Color(0xFF1A2D47);
const _text     = Color(0xFFF0F5FF);
const _textSub  = Color(0xFF8FA3BF);
const _textDim  = Color(0xFF4D6480);
const _emerald  = Color(0xFF10B981);
const _amber    = Color(0xFFF59E0B);
const _rose     = Color(0xFFF43F5E);

class AuditExceptionsWidget extends StatelessWidget {
  final AuditExceptions exceptions;

  const AuditExceptionsWidget({
    super.key,
    required this.exceptions,
  });

  @override
  Widget build(BuildContext context) {
    final isReady = exceptions.criticalCount == 0 && exceptions.warningCount == 0;

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
                child: const Icon(Icons.error_outline_rounded, color: _rose, size: 16),
              ),
              const SizedBox(width: 10),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'AUDIT EXCEPTIONS',
                    style: TextStyle(
                      color: _text,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Items requiring auditor sign-off',
                    style: TextStyle(color: _textDim, fontSize: 10),
                  ),
                ],
              ),
            ]),
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: _border),
          // ── Content ─────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: isReady
                ? _ClearBanner()
                : _ExceptionCards(exceptions: exceptions),
          ),
        ],
      ),
    );
  }
}

// ─── Clear Banner ─────────────────────────────────────────────────────────────
class _ClearBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _emerald.withValues(alpha: .08),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: _emerald.withValues(alpha: .25)),
    ),
    child: const Row(children: [
      Icon(Icons.check_circle_rounded, color: _emerald, size: 20),
      SizedBox(width: 10),
      Expanded(
        child: Text(
          'All exceptions resolved — Audit ready.',
          style: TextStyle(color: _emerald, fontSize: 13, fontWeight: FontWeight.w600),
        ),
      ),
    ]),
  );
}

// ─── Exception Cards ──────────────────────────────────────────────────────────
class _ExceptionCards extends StatelessWidget {
  final AuditExceptions exceptions;
  const _ExceptionCards({required this.exceptions});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      if (exceptions.criticalCount > 0) ...[
        Expanded(child: _ExCard(
          count: exceptions.criticalCount,
          label: 'Critical',
          color: _rose,
          icon: Icons.cancel_rounded,
        )),
        if (exceptions.warningCount > 0) const SizedBox(width: 10),
      ],
      if (exceptions.warningCount > 0)
        Expanded(child: _ExCard(
          count: exceptions.warningCount,
          label: 'Warnings',
          color: _amber,
          icon: Icons.info_rounded,
        )),
    ],
  );
}

class _ExCard extends StatelessWidget {
  final int count;
  final String label;
  final Color color;
  final IconData icon;

  const _ExCard({
    required this.count,
    required this.label,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _bg,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: color.withValues(alpha: .3)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(
          width: 28, height: 28,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 14),
        ),
        const Spacer(),
        Text(
          '$count',
          style: TextStyle(
            color: color,
            fontSize: 24,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
          ),
        ),
      ]),
      const SizedBox(height: 8),
      Text(
        label,
        style: const TextStyle(color: _textSub, fontSize: 11),
      ),
    ]),
  );
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/fnb_dashboard_data.dart';

const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _sapphire = Color(0xFF3B82F6);
const _violet = Color(0xFF8B5CF6);
const _gold = Color(0xFFD4AF37);
const _amber = Color(0xFFF59E0B);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF64748B);

final _fmtK = NumberFormat('#,##0.0', 'en');
String _fmtAmt(double v) {
  if (v >= 1000000) return '₦${_fmtK.format(v / 1000000)}M';
  if (v >= 1000) return '₦${_fmtK.format(v / 1000)}K';
  if (v <= 0) return '₦0';
  return '₦${v.toStringAsFixed(0)}';
}

/// Payment method breakdown with horizontal bar indicators
class FnbPaymentBreakdown extends StatelessWidget {
  final List<FnbPaymentMethod> payments;

  const FnbPaymentBreakdown({super.key, required this.payments});

  Color _methodColor(String method) {
    switch (method) {
      case 'Cash':             return _emerald;
      case 'Card':             return _sapphire;
      case 'Mobile / Gateway': return _violet;
      case 'Room Charge':      return _gold;
      case 'Bank Transfer':    return _amber;
      case 'City Ledger':      return const Color(0xFF06B6D4);
      case 'Complimentary':    return const Color(0xFFF43F5E);
      default:                 return _textMuted;
    }
  }

  IconData _methodIcon(String method) {
    switch (method) {
      case 'Cash':             return Icons.payments_rounded;
      case 'Card':             return Icons.credit_card_rounded;
      case 'Mobile / Gateway': return Icons.phone_android_rounded;
      case 'Room Charge':      return Icons.hotel_rounded;
      case 'Bank Transfer':    return Icons.account_balance_rounded;
      case 'City Ledger':      return Icons.business_rounded;
      case 'Complimentary':    return Icons.card_giftcard_rounded;
      default:                 return Icons.more_horiz_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _border),
        ),
        child: const Center(
          child: Text('No payment data today', style: TextStyle(color: _textMuted, fontSize: 13)),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: payments.asMap().entries.map((entry) {
          final idx = entry.key;
          final p = entry.value;
          final color = _methodColor(p.method);
          return Padding(
            padding: EdgeInsets.only(bottom: idx < payments.length - 1 ? 14 : 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(_methodIcon(p.method), color: color, size: 14),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        p.method,
                        style: const TextStyle(
                          color: _textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    Text(
                      _fmtAmt(p.amount),
                      style: TextStyle(
                        color: _textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 38,
                      child: Text(
                        '${p.pct.toStringAsFixed(0)}%',
                        style: TextStyle(
                          color: color,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                        textAlign: TextAlign.end,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                LayoutBuilder(
                  builder: (context, constraints) {
                    return Stack(
                      children: [
                        Container(
                          height: 4,
                          width: constraints.maxWidth,
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        Container(
                          height: 4,
                          width: constraints.maxWidth * (p.pct / 100).clamp(0.0, 1.0),
                          decoration: BoxDecoration(
                            color: color,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

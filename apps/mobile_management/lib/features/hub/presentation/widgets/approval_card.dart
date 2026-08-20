import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../data/hub_model.dart';

const _cardBg = Color(0xFF111D33);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);

class ApprovalCard extends StatelessWidget {
  final HubApproval approval;
  final VoidCallback onTap;

  const ApprovalCard({super.key, required this.approval, required this.onTap});

  String _formatTimeElapsed(DateTime createdAt) {
    final diff = DateTime.now().difference(createdAt);
    if (diff.inMinutes < 60) return '\${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '\${diff.inHours}h ago';
    return '\${diff.inDays}d ago';
  }

  String _formatAmount(double? amount, String? currency) {
    if (amount == null) return '';
    final curr = currency ?? '₦';
    final formatter = NumberFormat.currency(symbol: curr, decimalDigits: 0);
    return formatter.format(amount);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E3355)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      approval.type,
                      style: const TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    if (approval.amount != null)
                      Text(
                        _formatAmount(approval.amount, approval.currency),
                        style: const TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  approval.reason,
                  style: const TextStyle(color: _textSecondary, fontSize: 14),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '\${approval.requester.department} · \${approval.property.name}',
                        style: const TextStyle(color: _textSecondary, fontSize: 12),
                      ),
                    ),
                    Text(
                      _formatTimeElapsed(approval.createdAt),
                      style: const TextStyle(color: _textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

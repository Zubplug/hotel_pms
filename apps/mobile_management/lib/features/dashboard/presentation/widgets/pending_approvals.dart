import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/executive_dashboard_data.dart';

class PendingApprovalsWidget extends StatelessWidget {
  final ApprovalSummary? approvals;

  const PendingApprovalsWidget({super.key, this.approvals});

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const textSecondary = Color(0xFF94A3B8);
    const goldAccent = Color(0xFFD4AF37);
    final currencyFormat = NumberFormat.compactCurrency(symbol: '₦', decimalDigits: 0);

    if (approvals == null) {
      return _buildUnavailableState(surfaceNavy, textSecondary);
    }

    if (approvals!.pendingCount == 0) {
      return _buildAllCaughtUpState(surfaceNavy, textSecondary);
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '🔐 PENDING APPROVALS',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 2.0,
              fontWeight: FontWeight.w700,
              color: textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '${approvals!.pendingCount} items require your approval',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 16),
          ...approvals!.items.take(3).map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      currencyFormat.format(item.amount),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.title,
                      style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
                    ),
                    Text(
                      'Requested by ${item.requestedBy}',
                      style: const TextStyle(color: textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              )),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {},
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Review', style: TextStyle(color: goldAccent, fontWeight: FontWeight.w600)),
                  SizedBox(width: 4),
                  Icon(Icons.arrow_forward, color: goldAccent, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAllCaughtUpState(Color surface, Color textSec) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '🔐 PENDING APPROVALS',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 2.0,
              fontWeight: FontWeight.w700,
              color: textSec,
            ),
          ),
          const SizedBox(height: 16),
          const Row(
            children: [
              Icon(Icons.check, color: Colors.greenAccent, size: 20),
              SizedBox(width: 8),
              Text(
                'You\'re all caught up',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.only(left: 28),
            child: Text(
              'No approvals require your attention.',
              style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUnavailableState(Color surface, Color textSec) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '🔐 PENDING APPROVALS',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 2.0,
              fontWeight: FontWeight.w700,
              color: textSec,
            ),
          ),
          const SizedBox(height: 16),
          const Center(
            child: Text(
              '—\nData unavailable',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white54, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}

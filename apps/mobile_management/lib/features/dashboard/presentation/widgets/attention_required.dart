import 'package:flutter/material.dart';
import '../models/executive_dashboard_data.dart';

class AttentionRequiredWidget extends StatelessWidget {
  final List<AlertData>? alerts;

  const AttentionRequiredWidget({super.key, this.alerts});

  @override
  Widget build(BuildContext context) {
    const surfaceNavy = Color(0xFF1E293B);
    const textSecondary = Color(0xFF94A3B8);
    const goldAccent = Color(0xFFD4AF37);

    if (alerts == null) {
      return const SizedBox.shrink(); // Hide completely or show unavailable
    }

    if (alerts!.isEmpty) {
      return _buildAllClearState(surfaceNavy, textSecondary);
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
            '⚡ ATTENTION REQUIRED',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 2.0,
              fontWeight: FontWeight.w700,
              color: textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(Icons.circle, color: Colors.redAccent, size: 12),
              const SizedBox(width: 8),
              Text(
                '${alerts!.length} critical issues',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...alerts!.take(3).map((alert) => Padding(
                padding: const EdgeInsets.only(bottom: 8.0, left: 20),
                child: Text(
                  alert.title,
                  style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
                ),
              )),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {},
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('View all', style: TextStyle(color: goldAccent, fontWeight: FontWeight.w600)),
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

  Widget _buildAllClearState(Color surface, Color textSec) {
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
            '⚡ ATTENTION REQUIRED',
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
              Icon(Icons.check_circle, color: Colors.greenAccent, size: 20),
              SizedBox(width: 8),
              Text(
                'All clear',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.only(left: 28),
            child: Text(
              'No critical issues require your attention.',
              style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}

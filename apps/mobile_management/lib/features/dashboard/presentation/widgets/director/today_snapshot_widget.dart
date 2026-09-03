import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

class TodaySnapshotWidget extends StatelessWidget {
  final TodaySnapshot snapshot;

  const TodaySnapshotWidget({super.key, required this.snapshot});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TODAY\'S SNAPSHOT',
            style: TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 10,
              letterSpacing: 1.2,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildMetric('ARRIVALS', snapshot.arrivals.toString(), Icons.login, Colors.greenAccent),
              _buildDivider(),
              _buildMetric('DEPARTURES', snapshot.departures.toString(), Icons.logout, Colors.orangeAccent),
              _buildDivider(),
              _buildMetric('IN-HOUSE', snapshot.inHouseGuests.toString(), Icons.people_alt, Colors.blueAccent),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      height: 30,
      width: 1,
      color: const Color(0xFF334155),
    );
  }

  Widget _buildMetric(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 10,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import '../../models/executive_dashboard_data.dart';

class CompactRoomStatusWidget extends StatelessWidget {
  final RoomSummary summary;

  const CompactRoomStatusWidget({super.key, required this.summary});

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
            'ROOM STATUS',
            style: TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 10,
              letterSpacing: 1.2,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _buildStatusCell('Occupied', summary.occupied.toString(), Colors.blueAccent)),
              _buildDivider(),
              Expanded(child: _buildStatusCell('Vacant', summary.vacant.toString(), Colors.greenAccent)),
              _buildDivider(),
              Expanded(child: _buildStatusCell('Dirty', summary.dirty.toString(), Colors.orangeAccent)),
              _buildDivider(),
              Expanded(child: _buildStatusCell('OOO', summary.ooo.toString(), Colors.redAccent)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      height: 24,
      width: 1,
      color: const Color(0xFF334155),
      margin: const EdgeInsets.symmetric(horizontal: 8),
    );
  }

  Widget _buildStatusCell(String label, String count, Color color) {
    return Column(
      children: [
        Text(
          count,
          style: TextStyle(
            color: color,
            fontSize: 20,
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

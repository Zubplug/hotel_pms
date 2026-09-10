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
              // Occupied — all checked-in rooms, regardless of housekeeping status
              Expanded(
                child: _buildStatusCell(
                  'Occupied',
                  summary.occupied.toString(),
                  Colors.blueAccent,
                  // Sub-label: show how many are stayover-dirty
                  subLabel: summary.occupiedDirty > 0
                      ? '${summary.occupiedDirty} dirty'
                      : null,
                  subLabelColor: Colors.orangeAccent,
                ),
              ),
              _buildDivider(),
              // Vacant — rooms with no active check-in
              Expanded(
                child: _buildStatusCell(
                  'Vacant',
                  summary.vacant.toString(),
                  Colors.greenAccent,
                ),
              ),
              _buildDivider(),
              // Dirty — vacant rooms needing cleaning before next guest
              Expanded(
                child: _buildStatusCell(
                  'Dirty',
                  summary.dirty.toString(),
                  Colors.orangeAccent,
                ),
              ),
              _buildDivider(),
              // Out of Order / Out of Service
              Expanded(
                child: _buildStatusCell(
                  'OOO',
                  summary.ooo.toString(),
                  Colors.redAccent,
                ),
              ),
            ],
          ),

          // Stayover dirty warning bar (only shown when occupiedDirty > 0)
          if (summary.occupiedDirty > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFFF9800).withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: const Color(0xFFFF9800).withOpacity(0.3),
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cleaning_services_rounded,
                      size: 13, color: Color(0xFFFFA726)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${summary.occupiedDirty} occupied room${summary.occupiedDirty != 1 ? 's' : ''} '
                      'need housekeeping (stayover dirty)',
                      style: const TextStyle(
                        color: Color(0xFFFFA726),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
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

  Widget _buildStatusCell(
    String label,
    String count,
    Color color, {
    String? subLabel,
    Color? subLabelColor,
  }) {
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
        if (subLabel != null) ...[
          const SizedBox(height: 2),
          Text(
            subLabel,
            style: TextStyle(
              color: subLabelColor ?? Colors.orangeAccent,
              fontSize: 9,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ],
    );
  }
}

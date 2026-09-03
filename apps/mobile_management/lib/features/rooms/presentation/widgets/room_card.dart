import 'package:flutter/material.dart';
import '../../data/room_models.dart';
import 'room_status_badge.dart';
import 'package:intl/intl.dart';

class RoomCard extends StatelessWidget {
  final MobileRoomDetailedStatus room;
  final VoidCallback onTap;

  const RoomCard({super.key, required this.room, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      room.number,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 8),
                    RoomStatusBadge(status: room.displayStatus),
                  ],
                ),
                Text(
                  room.roomTypeName,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 12),
            
            // Indicators Row
            if (room.indicators.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Wrap(
                  spacing: 6,
                  children: room.indicators
                      .map((ind) => RoomStatusBadge(status: ind, isIndicator: true))
                      .toList(),
                ),
              ),

            // Main Content Area
            if (room.displayStatus == 'OCCUPIED' && room.guest != null)
              _buildOccupiedContent(room.guest!)
            else if (room.nextArrival != null)
              _buildUpcomingContent(room.nextArrival!, room.contextualNote)
            else if (room.contextualNote != null)
              _buildContextContent(room.contextualNote!),
          ],
        ),
      ),
    );
  }

  Widget _buildOccupiedContent(MobileRoomGuest guest) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.person, size: 14, color: Colors.blueAccent),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                guest.name,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Icon(Icons.calendar_today, size: 14, color: Colors.white.withOpacity(0.5)),
            const SizedBox(width: 6),
            Text(
              'Check-out: ${DateFormat('d MMM').format(guest.checkOut)}',
              style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildUpcomingContent(MobileRoomNextArrival nextArrival, String? note) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (note != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Colors.white.withOpacity(0.5)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    note,
                    style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        Row(
          children: [
            const Icon(Icons.flight_land, size: 14, color: Colors.greenAccent),
            const SizedBox(width: 6),
            Text(
              'Next arrival: ${nextArrival.arrivalDate}',
              style: const TextStyle(color: Colors.white, fontSize: 13),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildContextContent(String note) {
    return Row(
      children: [
        Icon(Icons.info_outline, size: 14, color: Colors.white.withOpacity(0.5)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            note,
            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
          ),
        ),
      ],
    );
  }
}

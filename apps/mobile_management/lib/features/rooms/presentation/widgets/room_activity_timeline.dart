import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class RoomActivityTimeline extends StatelessWidget {
  final List<dynamic> timelineEvents;

  const RoomActivityTimeline({super.key, required this.timelineEvents});

  @override
  Widget build(BuildContext context) {
    if (timelineEvents.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          'No recent activity',
          style: TextStyle(color: Colors.white.withOpacity(0.5)),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: timelineEvents.length,
      itemBuilder: (context, index) {
        final event = timelineEvents[index];
        final timestamp = DateTime.parse(event['timestamp']).toLocal();
        final timeString = DateFormat('HH:mm').format(timestamp);
        final dateString = DateFormat('dd MMM').format(timestamp);
        
        final isLast = index == timelineEvents.length - 1;

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time column
            SizedBox(
              width: 50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    timeString,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    dateString,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.4),
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            
            // Timeline line & dot
            Column(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: const BoxDecoration(
                    color: Colors.blueAccent,
                    shape: BoxShape.circle,
                  ),
                ),
                if (!isLast)
                  Container(
                    width: 2,
                    height: 40,
                    color: Colors.white.withOpacity(0.1),
                  ),
              ],
            ),
            
            const SizedBox(width: 16),
            
            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event['title'] ?? 'Event',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                      ),
                    ),
                    if (event['subtitle'] != null && event['subtitle'].toString().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        event['subtitle'],
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.6),
                          fontSize: 12,
                        ),
                      ),
                    ]
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:intl/intl.dart';

import '../providers/rooms_provider.dart';
import '../models/room_data.dart';

class RoomDetailsScreen extends ConsumerWidget {
  final String roomId;

  const RoomDetailsScreen({super.key, required this.roomId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomDetailsAsync = ref.watch(roomDetailsProvider(roomId));

    const primaryNavy = Color(0xFF0F172A);

    return Scaffold(
      backgroundColor: primaryNavy,
      appBar: AppBar(
        backgroundColor: primaryNavy,
        elevation: 0,
        title: const Text('Room Intelligence', style: TextStyle(fontSize: 16)),
      ),
      body: roomDetailsAsync.when(
        data: (data) => _buildBody(context, data),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Text('Failed to load room details.\n$err', style: const TextStyle(color: Colors.red)),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, RoomDetailsData data) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(data.room),
          const SizedBox(height: 24),
          _buildRevenueAvailability(data),
          const SizedBox(height: 24),
          _buildGuestSection(data.currentGuest),
          const SizedBox(height: 24),
          _buildNextArrivalSection(data.nextArrival),
          const SizedBox(height: 24),
          _buildHousekeepingSection(data.housekeeping),
          const SizedBox(height: 24),
          if (data.maintenance != null) ...[
            _buildMaintenanceSection(data.maintenance!),
            const SizedBox(height: 24),
          ],
          _buildTimelineSection(data.timeline),
          const SizedBox(height: 48),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildHeader(RoomItem room) {
    Color statusColor;
    switch (room.displayStatus) {
      case 'OCCUPIED': statusColor = Colors.blue; break;
      case 'READY': statusColor = Colors.green; break;
      case 'DIRTY': statusColor = Colors.orange; break;
      case 'OUT_OF_ORDER':
      case 'OUT_OF_SERVICE': statusColor = Colors.red; break;
      default: statusColor = Colors.grey;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'ROOM ${room.number}',
          style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 1.2),
        ),
        const SizedBox(height: 4),
        Text(
          room.roomType.name,
          style: const TextStyle(color: Colors.white70, fontSize: 16),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Icon(Icons.circle, color: statusColor, size: 12),
            const SizedBox(width: 8),
            Text(
              room.displayStatus.replaceAll('_', ' '),
              style: TextStyle(color: statusColor, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRevenueAvailability(RoomDetailsData data) {
    Color color;
    String text;
    String subtitle = '';

    switch (data.sellability) {
      case 'READY_TO_SELL':
        color = Colors.green;
        text = 'READY TO SELL';
        break;
      case 'NOT_SELLABLE':
        color = Colors.red;
        text = 'NOT SELLABLE';
        subtitle = data.maintenance?.reason ?? 'Out of Order';
        break;
      case 'NOT_READY':
      default:
        color = Colors.orange;
        text = 'NOT READY';
        if (data.room.displayStatus == 'OCCUPIED') {
          subtitle = 'Currently Occupied';
        } else {
          subtitle = 'Housekeeping: ${data.housekeeping.status}';
        }
        break;
    }

    return _buildSectionCard(
      title: 'REVENUE AVAILABILITY',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.circle, color: color, size: 10),
              const SizedBox(width: 8),
              Text(text, style: TextStyle(color: color, fontWeight: FontWeight.bold)),
            ],
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
        ],
      ),
    );
  }

  Widget _buildGuestSection(CurrentGuestInfo? guest) {
    if (guest == null) {
      return _buildSectionCard(
        title: 'CURRENT GUEST',
        child: const Text('No current guest', style: TextStyle(color: Colors.white70)),
      );
    }

    final format = DateFormat('MMM d, h:mm a');

    return _buildSectionCard(
      title: 'CURRENT GUEST',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            guest.name ?? 'Guest Name Hidden',
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          if (guest.vipLevel != null) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: const Color(0xFFD4AF37), borderRadius: BorderRadius.circular(4)),
              child: Text(guest.vipLevel!, style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
          const SizedBox(height: 12),
          _buildInfoRow('Check-In', format.format(guest.checkIn)),
          const SizedBox(height: 4),
          _buildInfoRow('Check-Out', format.format(guest.checkOut)),
          const SizedBox(height: 4),
          if (guest.folioBalance != null)
            _buildInfoRow('Balance', '\$${guest.folioBalance!.toStringAsFixed(2)}'),
        ],
      ),
    );
  }

  Widget _buildNextArrivalSection(NextArrivalInfo? arrival) {
    if (arrival == null) {
      return _buildSectionCard(
        title: 'NEXT ARRIVAL',
        child: const Text('No upcoming arrivals', style: TextStyle(color: Colors.white70)),
      );
    }

    final dateFormat = DateFormat('MMM d');
    final isToday = arrival.arrivalDate.day == DateTime.now().day &&
        arrival.arrivalDate.month == DateTime.now().month &&
        arrival.arrivalDate.year == DateTime.now().year;
    final dateStr = isToday ? 'Today' : dateFormat.format(arrival.arrivalDate);
    final arrivalTimeDisplay = arrival.arrivalTime != null ? ' · ${arrival.arrivalTime}' : '';

    return _buildSectionCard(
      title: 'NEXT ARRIVAL',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            arrival.guestName ?? 'Guest Name Hidden',
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text('$dateStr$arrivalTimeDisplay', style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 4),
          Text('${arrival.nights} nights', style: const TextStyle(color: Colors.white54)),
        ],
      ),
    );
  }

  Widget _buildHousekeepingSection(HousekeepingInfo hk) {
    Color color = hk.status == 'CLEAN' || hk.status == 'INSPECTED' ? Colors.green : Colors.orange;
    
    return _buildSectionCard(
      title: 'HOUSEKEEPING',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.circle, color: color, size: 10),
              const SizedBox(width: 8),
              Text(hk.status, style: TextStyle(color: color, fontWeight: FontWeight.bold)),
            ],
          ),
          if (hk.lastUpdatedAt != null) ...[
            const SizedBox(height: 8),
            Text('Updated: ${timeago.format(hk.lastUpdatedAt!)}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
          if (hk.assignedTo != null) ...[
            const SizedBox(height: 4),
            Text('Assigned: ${hk.assignedTo}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
        ],
      ),
    );
  }

  Widget _buildMaintenanceSection(MaintenanceInfo maintenance) {
    return _buildSectionCard(
      title: 'MAINTENANCE',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.circle, color: Colors.red, size: 10),
              const SizedBox(width: 8),
              Text('${maintenance.priority} · ${maintenance.status.replaceAll('_', ' ')}', style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          Text(maintenance.reason, style: const TextStyle(color: Colors.white, fontSize: 14)),
          if (maintenance.expectedResolutionAt != null) ...[
            const SizedBox(height: 8),
            Text('Expected: ${DateFormat('MMM d · HH:mm').format(maintenance.expectedResolutionAt!)}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
        ],
      ),
    );
  }

  Widget _buildTimelineSection(List<TimelineEvent> timeline) {
    if (timeline.isEmpty) {
      return _buildSectionCard(
        title: 'ROOM TIMELINE',
        child: const Text('No recent activity', style: TextStyle(color: Colors.white70)),
      );
    }

    final format = DateFormat('MMM d · HH:mm');

    return _buildSectionCard(
      title: 'ROOM TIMELINE',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: timeline.map((event) {
          IconData icon;
          Color color;
          switch (event.type) {
            case 'MAINTENANCE': icon = Icons.build; color = Colors.red; break;
            case 'HOUSEKEEPING': icon = Icons.cleaning_services; color = Colors.orange; break;
            default: icon = Icons.info_outline; color = Colors.blue; break;
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 16.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: color, size: 16),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(format.format(event.timestamp), style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(event.title, style: const TextStyle(color: Colors.white, fontSize: 14)),
                      if (event.subtitle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(event.subtitle, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildActionButton('View Maintenance', Icons.build_outlined),
        const SizedBox(height: 12),
        _buildActionButton('View Room History', Icons.history),
      ],
    );
  }

  Widget _buildActionButton(String label, IconData icon) {
    return OutlinedButton.icon(
      icon: Icon(icon, color: Colors.white, size: 18),
      label: Text(label, style: const TextStyle(color: Colors.white)),
      onPressed: null, // Read-only v1 — navigation actions to be connected per screen
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 16),
        side: const BorderSide(color: Color(0xFF334155)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        disabledForegroundColor: Colors.white54,
        disabledIconColor: Colors.white54,
      ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
    const surfaceNavy = Color(0xFF1E293B);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.1),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 14)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 14)),
      ],
    );
  }
}

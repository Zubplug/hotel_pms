import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/rooms_provider.dart';
import '../models/room_data.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'room_details_screen.dart';

class RoomsScreen extends ConsumerStatefulWidget {
  const RoomsScreen({super.key});

  @override
  ConsumerState<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends ConsumerState<RoomsScreen> {
  String _currentFilter = 'All';

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const textPrimary = Colors.white;
    const textSecondary = Color(0xFF94A3B8);

    final roomsDataAsync = ref.watch(roomsDataProvider);

    return Scaffold(
      backgroundColor: primaryNavy,
      appBar: AppBar(
        backgroundColor: primaryNavy,
        elevation: 0,
        title: roomsDataAsync.when(
          data: (data) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                data.property.name.toUpperCase(),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2, color: textSecondary),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(Icons.circle, color: Colors.green, size: 8),
                  const SizedBox(width: 6),
                  Text(
                    'Live · Updated ${timeago.format(data.generatedAt)}',
                    style: const TextStyle(fontSize: 10, color: textPrimary),
                  ),
                ],
              ),
            ],
          ),
          loading: () => const Text('Loading...', style: TextStyle(fontSize: 14)),
          error: (err, stack) => const Text('Offline', style: TextStyle(fontSize: 14)),
        ),
      ),
      body: roomsDataAsync.when(
        data: (data) {
          final filteredRooms = _getFilteredRooms(data.rooms, _currentFilter);

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildOverviewGrid(data.overview),
                      const SizedBox(height: 24),
                      _buildFilterBar(),
                      const SizedBox(height: 16),
                      Text(
                        '${filteredRooms.length} Rooms',
                        style: const TextStyle(color: textSecondary, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    return _buildRoomItem(filteredRooms[index]);
                  },
                  childCount: filteredRooms.length,
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Text(
              'Failed to load rooms.\n$err',
              style: const TextStyle(color: Colors.red),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }

  List<RoomItem> _getFilteredRooms(List<RoomItem> rooms, String filter) {
    if (filter == 'All') return rooms;
    if (filter == 'Occupied') return rooms.where((r) => r.displayStatus == 'OCCUPIED').toList();
    if (filter == 'Ready') return rooms.where((r) => r.displayStatus == 'READY').toList();
    if (filter == 'Dirty') return rooms.where((r) => r.displayStatus == 'DIRTY').toList();
    if (filter == 'OOO') return rooms.where((r) => r.displayStatus == 'OUT_OF_ORDER').toList();
    if (filter == 'OOS') return rooms.where((r) => r.displayStatus == 'OUT_OF_SERVICE').toList();
    return rooms;
  }

  Widget _buildOverviewGrid(RoomOverview overview) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - 24) / 4;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _buildOverviewCard('Ready', overview.ready.toString(), Colors.green, itemWidth),
            _buildOverviewCard('Occupied', overview.occupied.toString(), Colors.blue, itemWidth),
            _buildOverviewCard('Dirty', overview.dirty.toString(), Colors.orange, itemWidth),
            _buildOverviewCard('OOO/OOS', (overview.outOfOrder + overview.outOfService).toString(), Colors.red, itemWidth),
          ],
        );
      },
    );
  }

  Widget _buildOverviewCard(String title, String value, Color color, double width) {
    const surfaceNavy = Color(0xFF1E293B);
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(
              fontSize: 11,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    final filters = ['All', 'Occupied', 'Ready', 'Dirty', 'OOO', 'OOS'];
    
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((filter) {
          final isSelected = _currentFilter == filter;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(filter),
              selected: isSelected,
              onSelected: (selected) {
                if (selected) {
                  setState(() => _currentFilter = filter);
                }
              },
              backgroundColor: const Color(0xFF1E293B),
              selectedColor: const Color(0xFFD4AF37).withValues(alpha: 0.2),
              labelStyle: TextStyle(
                color: isSelected ? const Color(0xFFD4AF37) : Colors.white70,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? const Color(0xFFD4AF37) : Colors.transparent,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildRoomItem(RoomItem room) {
    const surfaceNavy = Color(0xFF1E293B);
    
    Color statusColor;
    String displayStatusText;
    
    switch (room.displayStatus) {
      case 'OCCUPIED':
        statusColor = Colors.blue;
        displayStatusText = 'OCCUPIED';
        break;
      case 'READY':
        statusColor = Colors.green;
        displayStatusText = 'VACANT · READY';
        break;
      case 'DIRTY':
        statusColor = Colors.orange;
        displayStatusText = 'VACANT · DIRTY';
        break;
      case 'OUT_OF_ORDER':
      case 'OUT_OF_SERVICE':
        statusColor = Colors.red;
        displayStatusText = _capitalizeStatus(room.displayStatus);
        break;
      default:
        statusColor = Colors.grey;
        displayStatusText = room.displayStatus;
    }
    
    String displayRoomNumber = room.number;
    String? locationSubText;
    if (room.number.contains('.')) {
      final parts = room.number.split('.');
      if (parts.length >= 3) {
        displayRoomNumber = parts.last;
        locationSubText = 'Building ${parts[0]} · Floor ${parts[1]}';
      }
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: surfaceNavy,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.2)),
      ),
      child: InkWell(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => RoomDetailsScreen(roomId: room.id),
            ),
          );
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'ROOM $displayRoomNumber',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      letterSpacing: 1.1,
                    ),
                  ),
                  Icon(Icons.chevron_right, color: Colors.white.withValues(alpha: 0.3)),
                ],
              ),
              const SizedBox(height: 4),
              if (locationSubText != null) ...[
                Text(
                  locationSubText,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 4),
              ],
              Text(
                room.roomType.name,
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.circle, color: statusColor, size: 10),
                  const SizedBox(width: 8),
                  Text(
                    displayStatusText,
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              if (room.contextualNote != null && room.contextualNote!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  room.contextualNote!,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _capitalizeStatus(String s) {
    if (s.isEmpty) return s;
    final parts = s.split('_');
    return parts.map((p) => p[0].toUpperCase() + p.substring(1).toLowerCase()).join(' ');
  }
}

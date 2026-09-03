import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../../core/api/api_client.dart';
import '../data/live_room_repository.dart';
import '../data/room_models.dart';
import 'room_details_screen.dart';
import 'widgets/room_card.dart';

class RoomsScreen extends StatefulWidget {
  const RoomsScreen({super.key});

  @override
  State<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends State<RoomsScreen> {
  late LiveRoomRepository _repository;
  ExecutiveRoomsData? _data;
  bool _isLoading = true;
  String? _error;
  
  String _selectedFilter = 'All';
  String _searchQuery = '';
  
  final List<String> _filters = [
    'All', 'Occupied', 'Vacant', 'Dirty', 'Clean', 'OOO/OOS'
  ];

  @override
  void initState() {
    super.initState();
    _repository = LiveRoomRepository(ApiClient());
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final data = await _repository.getExecutiveRooms();
      setState(() {
        _data = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<MobileRoomDetailedStatus> get _filteredRooms {
    if (_data == null) return [];
    
    var rooms = _data!.rooms;
    
    // Apply Filter
    if (_selectedFilter != 'All') {
      rooms = rooms.where((r) {
        switch (_selectedFilter) {
          case 'Occupied': return r.displayStatus == 'OCCUPIED';
          case 'Vacant': return r.availabilityStatus == 'VACANT';
          case 'Dirty': return r.displayStatus == 'DIRTY';
          case 'Clean': return r.displayStatus == 'READY';
          case 'OOO/OOS': return r.displayStatus == 'OUT_OF_ORDER' || r.displayStatus == 'OUT_OF_SERVICE';
          default: return true;
        }
      }).toList();
    }
    
    // Apply Search
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      rooms = rooms.where((r) {
        if (r.number.toLowerCase().contains(query)) return true;
        if (r.roomTypeName.toLowerCase().contains(query)) return true;
        if (r.guest?.name.toLowerCase().contains(query) ?? false) return true;
        return false;
      }).toList();
    }
    
    return rooms;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Rooms', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // Toggle search bar visibility in real app
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        backgroundColor: const Color(0xFF1E293B),
        color: Colors.blueAccent,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _data == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _data == null) {
      return Center(
        child: Text('Error: $_error', style: const TextStyle(color: Colors.redAccent)),
      );
    }
    if (_data == null) return const SizedBox.shrink();

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _buildSummaryBar()),
        SliverToBoxAdapter(child: _buildFilters()),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final room = _filteredRooms[index];
                return RoomCard(
                  room: room,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => RoomDetailsScreen(
                          roomId: room.id,
                          roomNumber: room.number,
                        ),
                      ),
                    );
                  },
                );
              },
              childCount: _filteredRooms.length,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryBar() {
    final ov = _data!.overview;
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${ov.total} Total Rooms',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(color: Colors.greenAccent, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Updated ${timeago.format(_data!.lastUpdated, allowFromNow: true)}',
                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _buildSummaryStat('${ov.occupied}', 'Occupied', Colors.blueAccent),
              _buildSummaryStat('${ov.vacant}', 'Vacant', Colors.greenAccent),
              _buildSummaryStat('${ov.dirty}', 'Dirty', Colors.orangeAccent),
              _buildSummaryStat('${ov.outOfOrder + ov.outOfService}', 'OOO/OOS', Colors.redAccent),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildSummaryStat(String value, String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12)),
      ],
    );
  }

  Widget _buildFilters() {
    return SizedBox(
      height: 50,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _filters.length,
        itemBuilder: (context, index) {
          final filter = _filters[index];
          final isSelected = filter == _selectedFilter;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: FilterChip(
              label: Text(filter),
              selected: isSelected,
              onSelected: (selected) {
                setState(() => _selectedFilter = filter);
              },
              backgroundColor: const Color(0xFF1E293B),
              selectedColor: Colors.blueAccent.withOpacity(0.2),
              labelStyle: TextStyle(
                color: isSelected ? Colors.blueAccent : Colors.white.withOpacity(0.7),
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              side: BorderSide(
                color: isSelected ? Colors.blueAccent.withOpacity(0.5) : Colors.white.withOpacity(0.1),
              ),
            ),
          );
        },
      ),
    );
  }
}

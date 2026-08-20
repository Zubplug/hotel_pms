import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/rooms_provider.dart';
import '../models/room_data.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'room_details_screen.dart';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const _bg           = Color(0xFF08090E);
const _surface      = Color(0xFF111318);
const _border       = Color(0xFF252A35);
const _gold         = Color(0xFFD4AF37);
const _textPrimary  = Color(0xFFF0F4FF);
const _textSecondary= Color(0xFF8B92A5);
const _textMuted    = Color(0xFF4E5566);
const _green        = Color(0xFF22C55E);
const _blue         = Color(0xFF3B82F6);
const _orange       = Color(0xFFF97316);
const _red          = Color(0xFFEF4444);

class RoomsScreen extends ConsumerStatefulWidget {
  const RoomsScreen({super.key});

  @override
  ConsumerState<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends ConsumerState<RoomsScreen>
    with SingleTickerProviderStateMixin {
  String _filter = 'All';
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  final _filters = ['All', 'Occupied', 'Ready', 'Dirty', 'OOO', 'OOS'];

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  // ── Status helpers ────────────────────────────────────────────────────────────
  Color _statusColor(String status) {
    switch (status) {
      case 'OCCUPIED':        return _blue;
      case 'READY':           return _green;
      case 'DIRTY':           return _orange;
      case 'OUT_OF_ORDER':    return _red;
      case 'OUT_OF_SERVICE':  return _red;
      default:                return _textMuted;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'OCCUPIED':        return 'OCCUPIED';
      case 'READY':           return 'VACANT · READY';
      case 'DIRTY':           return 'VACANT · DIRTY';
      case 'OUT_OF_ORDER':    return 'OUT OF ORDER';
      case 'OUT_OF_SERVICE':  return 'OUT OF SERVICE';
      default:                return status.replaceAll('_', ' ');
    }
  }

  // ── Filter logic ─────────────────────────────────────────────────────────────
  List<RoomItem> _filtered(List<RoomItem> rooms) {
    switch (_filter) {
      case 'Occupied': return rooms.where((r) => r.displayStatus == 'OCCUPIED').toList();
      case 'Ready':    return rooms.where((r) => r.displayStatus == 'READY').toList();
      case 'Dirty':    return rooms.where((r) => r.displayStatus == 'DIRTY').toList();
      case 'OOO':      return rooms.where((r) => r.displayStatus == 'OUT_OF_ORDER').toList();
      case 'OOS':      return rooms.where((r) => r.displayStatus == 'OUT_OF_SERVICE').toList();
      default:         return rooms;
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(roomsDataProvider);

    return Scaffold(
      backgroundColor: _bg,
      body: async.when(
        data: _buildBody,
        loading: () => const Center(child: CircularProgressIndicator(color: _gold)),
        error: (err, _) => _buildError(err),
      ),
    );
  }

  Widget _buildBody(RoomDashboardData data) {
    final rooms = _filtered(data.rooms);

    return CustomScrollView(
      slivers: [
        // ── App Bar ────────────────────────────────────────────────────────────
        SliverAppBar(
          pinned: true,
          backgroundColor: _bg,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          flexibleSpace: Container(
            decoration: BoxDecoration(
              color: _bg,
              border: Border(bottom: BorderSide(color: _border, width: 0.5)),
            ),
          ),
          title: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    data.property.name.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                      color: _textSecondary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      AnimatedBuilder(
                        animation: _pulseAnim,
                        builder: (_, __) => Container(
                          width: 6, height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _green.withOpacity(_pulseAnim.value),
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Live · ${timeago.format(data.generatedAt)}',
                        style: const TextStyle(fontSize: 10, color: _textMuted),
                      ),
                    ],
                  ),
                ],
              ),
              const Spacer(),
              // Business date badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: _gold.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _gold.withOpacity(0.3)),
                ),
                child: Text(
                  '${data.businessDate.day} ${_monthName(data.businessDate.month)}',
                  style: const TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w700,
                    color: _gold, letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
        ),

        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),

              // ── Occupancy Banner ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _OccupancyBanner(overview: data.overview),
              ),
              const SizedBox(height: 16),

              // ── Filter Bar ───────────────────────────────────────────────────
              _FilterBar(
                filters: _filters,
                selected: _filter,
                onSelect: (f) => setState(() => _filter = f),
                overview: data.overview,
              ),
              const SizedBox(height: 16),

              // ── Room count ───────────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Text(
                      '${rooms.length}',
                      style: const TextStyle(
                        color: _textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      rooms.length == 1 ? 'room' : 'rooms',
                      style: const TextStyle(color: _textMuted, fontSize: 13),
                    ),
                    if (_filter != 'All') ...[
                      const SizedBox(width: 6),
                      Text(
                        '· $_filter',
                        style: const TextStyle(color: _gold, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),

        // ── Room List ──────────────────────────────────────────────────────────
        rooms.isEmpty
            ? SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bed_rounded, color: _textMuted, size: 48),
                      const SizedBox(height: 12),
                      Text(
                        'No $_filter rooms',
                        style: const TextStyle(color: _textSecondary, fontSize: 15),
                      ),
                    ],
                  ),
                ),
              )
            : SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: _RoomCard(
                      room: rooms[i],
                      statusColor: _statusColor(rooms[i].displayStatus),
                      statusLabel: _statusLabel(rooms[i].displayStatus),
                      onTap: () => Navigator.of(ctx).push(
                        MaterialPageRoute(
                          builder: (_) => RoomDetailsScreen(roomId: rooms[i].id),
                        ),
                      ),
                    ),
                  ),
                  childCount: rooms.length,
                ),
              ),

        const SliverToBoxAdapter(child: SizedBox(height: 60)),
      ],
    );
  }

  Widget _buildError(Object err) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off_rounded, color: _textMuted, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Could not load rooms',
            style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Text('$err',
              style: const TextStyle(color: _textSecondary, fontSize: 12),
              textAlign: TextAlign.center),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () => ref.refresh(roomsDataProvider),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: _gold, borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('Retry',
                  style: TextStyle(color: _bg, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  String _monthName(int m) =>
      ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
}

// ─── Occupancy Banner ──────────────────────────────────────────────────────────
class _OccupancyBanner extends StatelessWidget {
  final RoomOverview overview;
  const _OccupancyBanner({required this.overview});

  @override
  Widget build(BuildContext context) {
    final occupancy = overview.total > 0
        ? (overview.occupied / overview.total * 100).toStringAsFixed(0)
        : '0';
    final oooOos = overview.outOfOrder + overview.outOfService;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF161A24), Color(0xFF0F1219)],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF252A35)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top: occupancy % + total rooms
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$occupancy%',
                style: const TextStyle(
                  fontSize: 44,
                  fontWeight: FontWeight.w800,
                  color: _textPrimary,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(width: 10),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Occupancy', style: TextStyle(color: _textSecondary, fontSize: 13)),
                    Text(
                      '${overview.total} rooms total',
                      style: const TextStyle(color: _textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              // Occupied count highlight
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _blue.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _blue.withOpacity(0.25)),
                ),
                child: Column(
                  children: [
                    Text(
                      '${overview.occupied}',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: _blue,
                      ),
                    ),
                    const Text('In House',
                        style: TextStyle(fontSize: 9, color: _textMuted, letterSpacing: 0.5)),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Occupancy bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: overview.total > 0 ? overview.occupied / overview.total : 0,
              backgroundColor: const Color(0xFF252A35),
              valueColor: AlwaysStoppedAnimation<Color>(
                overview.occupied / (overview.total > 0 ? overview.total : 1) > 0.8
                    ? _green
                    : _blue,
              ),
              minHeight: 6,
            ),
          ),

          const SizedBox(height: 16),
          Divider(color: const Color(0xFF252A35).withOpacity(0.8), height: 1),
          const SizedBox(height: 16),

          // Stat pills row
          Row(
            children: [
              _StatPill(value: overview.ready, label: 'Ready', color: _green),
              const SizedBox(width: 8),
              _StatPill(value: overview.dirty, label: 'Dirty', color: _orange),
              const SizedBox(width: 8),
              _StatPill(value: overview.vacant, label: 'Vacant', color: _textSecondary),
              const SizedBox(width: 8),
              _StatPill(value: oooOos, label: 'OOO/OOS', color: _red),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final int value;
  final String label;
  final Color color;
  const _StatPill({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(label,
                style: TextStyle(fontSize: 9, color: color.withOpacity(0.7), letterSpacing: 0.3)),
          ],
        ),
      ),
    );
  }
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
class _FilterBar extends StatelessWidget {
  final List<String> filters;
  final String selected;
  final ValueChanged<String> onSelect;
  final RoomOverview overview;
  const _FilterBar({
    required this.filters,
    required this.selected,
    required this.onSelect,
    required this.overview,
  });

  int _count(String f, RoomOverview o) {
    switch (f) {
      case 'Occupied': return o.occupied;
      case 'Ready':    return o.ready;
      case 'Dirty':    return o.dirty;
      case 'OOO':      return o.outOfOrder;
      case 'OOS':      return o.outOfService;
      default:         return o.total;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: filters.map((f) {
          final isSelected = f == selected;
          final count = _count(f, overview);
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onSelect(f),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? _gold.withOpacity(0.12) : _surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? _gold : const Color(0xFF252A35),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      f,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? _gold : _textSecondary,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: isSelected ? _gold.withOpacity(0.2) : const Color(0xFF252A35),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$count',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? _gold : _textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── Room Card ────────────────────────────────────────────────────────────────
class _RoomCard extends StatelessWidget {
  final RoomItem room;
  final Color statusColor;
  final String statusLabel;
  final VoidCallback onTap;
  const _RoomCard({
    required this.room,
    required this.statusColor,
    required this.statusLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Parse room number parts
    String displayNumber = room.number;
    String? locationText;
    if (room.number.contains('.')) {
      final parts = room.number.split('.');
      if (parts.length >= 3) {
        displayNumber = parts.last;
        locationText = 'Building ${parts[0]} · Floor ${parts[1]}';
      }
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF111318),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: statusColor.withOpacity(0.2)),
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Status stripe ──────────────────────────────────────────────
              Container(
                width: 4,
                color: statusColor,
              ),

              // ── Card body ─────────────────────────────────────────────────
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Left: room number + type
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Text(
                                  displayNumber,
                                  style: const TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.w800,
                                    color: _textPrimary,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                if (locationText != null) ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    locationText,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: _textMuted,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              room.roomType.name,
                              style: const TextStyle(fontSize: 13, color: _textSecondary),
                            ),
                            if (room.contextualNote != null &&
                                room.contextualNote!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                room.contextualNote!,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: statusColor.withOpacity(0.8),
                                  fontStyle: FontStyle.italic,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ],
                        ),
                      ),

                      // Right: status badge + chevron
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Status badge pill
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: statusColor.withOpacity(0.35)),
                            ),
                            child: Text(
                              statusLabel,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: statusColor,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: _textMuted,
                            size: 20,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

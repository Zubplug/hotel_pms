import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/rooms_provider.dart';
import '../models/room_data.dart';

import 'room_details_screen.dart';

// ─── Design System ────────────────────────────────────────────────────────────
const _bg           = Color(0xFF060B14);
const _surface      = Color(0xFF0D1422);
const _surfaceRaised = Color(0xFF111927);

const _border       = Color(0xFF1E2D40);
const _borderHigh   = Color(0xFF263548);
const _gold         = Color(0xFFD4AF37);

const _textPrimary  = Color(0xFFF0F4FF);
const _textSecondary= Color(0xFF8B95B0);
const _textMuted    = Color(0xFF4A5468);

// Status colors
const _statusOccupied   = Color(0xFF3B82F6);
const _statusReady      = Color(0xFF10B981);
const _statusDirty      = Color(0xFFF97316);
const _statusOOO        = Color(0xFFEF4444);
const _statusOOS        = Color(0xFF8B5CF6);
const _statusStayDirty  = Color(0xFFF59E0B);

// ─── Rooms Screen ─────────────────────────────────────────────────────────────
class RoomsScreen extends ConsumerStatefulWidget {
  const RoomsScreen({super.key});

  @override
  ConsumerState<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends ConsumerState<RoomsScreen>
    with TickerProviderStateMixin {
  String _filter = 'ALL';
  _ViewMode _viewMode = _ViewMode.list;

  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.35, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  static const _dirtyHKStatuses = {'DIRTY', 'PENDING', 'ASSIGNED', 'CLEANING'};

  bool _isStayoverDirty(RoomItem room) =>
      room.displayStatus == 'OCCUPIED' &&
      _dirtyHKStatuses.contains(room.housekeepingStatus.toUpperCase());

  Color _statusColor(RoomItem room) {
    if (_isStayoverDirty(room)) return _statusStayDirty;
    switch (room.displayStatus) {
      case 'OCCUPIED':       return _statusOccupied;
      case 'READY':          return _statusReady;
      case 'DIRTY':          return _statusDirty;
      case 'OUT_OF_ORDER':   return _statusOOO;
      case 'OUT_OF_SERVICE': return _statusOOS;
      default:               return _textMuted;
    }
  }

  String _statusLabel(RoomItem room) {
    if (_isStayoverDirty(room)) return 'STAY · DIRTY';
    switch (room.displayStatus) {
      case 'OCCUPIED':       return 'OCCUPIED';
      case 'READY':          return 'VACANT · READY';
      case 'DIRTY':          return 'VACANT · DIRTY';
      case 'OUT_OF_ORDER':   return 'OUT OF ORDER';
      case 'OUT_OF_SERVICE': return 'OUT OF SERVICE';
      default:               return room.displayStatus.replaceAll('_', ' ');
    }
  }

  List<RoomItem> _filtered(List<RoomItem> rooms) {
    switch (_filter) {
      case 'OCCUPIED': return rooms.where((r) => r.displayStatus == 'OCCUPIED').toList();
      case 'READY':    return rooms.where((r) => r.displayStatus == 'READY').toList();
      case 'DIRTY':    return rooms.where((r) =>
          r.displayStatus == 'DIRTY' || _isStayoverDirty(r)).toList();
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
        loading: () => _buildSkeleton(),
        error: (err, _) => _buildError(err),
      ),
    );
  }

  Widget _buildBody(RoomDashboardData data) {
    final rooms = _filtered(data.rooms);

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // ── Sticky App Bar ────────────────────────────────────────────────────
        SliverAppBar(
          pinned: true,
          floating: false,
          backgroundColor: _bg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          toolbarHeight: 58,
          automaticallyImplyLeading: false,
          title: _RoomsHeaderContent(
            data: data,
            viewMode: _viewMode,
            pulseAnim: _pulseAnim,
            onViewModeChanged: (m) => setState(() => _viewMode = m),
            onRefresh: () => ref.refresh(roomsDataProvider),
          ),
          titleSpacing: 0,
        ),

        SliverToBoxAdapter(
          child: Column(
            children: [
              const SizedBox(height: 16),

              // ── Analytics Mini Bar ───────────────────────────────────────
              _AnalyticsMiniBar(overview: data.overview, snapshot: data),
              const SizedBox(height: 16),

              // ── Filter Bar ───────────────────────────────────────────────
              _FilterBar(
                selected: _filter,
                overview: data.overview,
                onSelect: (f) => setState(() => _filter = f),
                rooms: data.rooms,
                isStayoverDirty: _isStayoverDirty,
              ),
              const SizedBox(height: 16),

              // ── Results label ────────────────────────────────────────────
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
                    if (_filter != 'ALL') ...[
                      const SizedBox(width: 6),
                      Text(
                        '· ${_filterLabel(_filter)}',
                        style: const TextStyle(
                          color: _gold,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),

        // ── Room List / Grid ──────────────────────────────────────────────
        if (rooms.isEmpty)
          SliverFillRemaining(
            child: _buildEmptyState(),
          )
        else if (_viewMode == _ViewMode.grid)
          _buildGridSliver(rooms)
        else
          _buildListSliver(rooms),

        const SliverToBoxAdapter(child: SizedBox(height: 80)),
      ],
    );
  }

  Widget _buildListSliver(List<RoomItem> rooms) {
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (ctx, i) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: _PremiumRoomCard(
            room: rooms[i],
            statusColor: _statusColor(rooms[i]),
            statusLabel: _statusLabel(rooms[i]),
            isStayoverDirty: _isStayoverDirty(rooms[i]),
            onTap: () => _openDetails(ctx, rooms[i].id),
          ),
        ),
        childCount: rooms.length,
      ),
    );
  }

  Widget _buildGridSliver(List<RoomItem> rooms) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 0.85,
        ),
        delegate: SliverChildBuilderDelegate(
          (ctx, i) => _RoomGridTile(
            room: rooms[i],
            statusColor: _statusColor(rooms[i]),
            statusLabel: _statusLabel(rooms[i]),
            isStayoverDirty: _isStayoverDirty(rooms[i]),
            onTap: () => _openDetails(ctx, rooms[i].id),
          ),
          childCount: rooms.length,
        ),
      ),
    );
  }

  void _openDetails(BuildContext ctx, String roomId) {
    HapticFeedback.selectionClick();
    Navigator.of(ctx).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => RoomDetailsScreen(roomId: roomId),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut)),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 320),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: _surface,
              shape: BoxShape.circle,
              border: Border.all(color: _border),
            ),
            child: const Icon(Icons.bed_rounded, color: _textMuted, size: 34),
          ),
          const SizedBox(height: 16),
          Text(
            'No ${_filterLabel(_filter).toLowerCase()} rooms',
            style: const TextStyle(
              color: _textSecondary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'All rooms in this category are clear.',
            style: TextStyle(color: _textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildSkeleton() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 100, 16, 80),
      children: [
        _SkeletonBar(height: 80),
        const SizedBox(height: 14),
        _SkeletonBar(height: 52),
        const SizedBox(height: 20),
        for (int i = 0; i < 6; i++) ...[
          _SkeletonBar(height: 90),
          const SizedBox(height: 10),
        ],
      ],
    );
  }

  Widget _buildError(Object err) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF1A0F0F),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF3D1F1F)),
            ),
            child: const Icon(Icons.wifi_off_rounded, color: _statusOOO, size: 36),
          ),
          const SizedBox(height: 20),
          const Text('Could not load rooms', style: TextStyle(color: _textPrimary, fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text('$err', style: const TextStyle(color: _textSecondary, fontSize: 12), textAlign: TextAlign.center),
          ),
          const SizedBox(height: 28),
          GestureDetector(
            onTap: () => ref.refresh(roomsDataProvider),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
              decoration: BoxDecoration(
                color: _surfaceRaised,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _gold),
              ),
              child: const Text('Retry', style: TextStyle(color: _gold, fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }

  String _filterLabel(String f) {
    switch (f) {
      case 'OCCUPIED': return 'Occupied';
      case 'READY':    return 'Vacant · Ready';
      case 'DIRTY':    return 'Needs Cleaning';
      case 'OOO':      return 'Out of Order';
      case 'OOS':      return 'Out of Service';
      default:         return 'All Rooms';
    }
  }
}

enum _ViewMode { list, grid }

// ─── Header Content Widget ────────────────────────────────────────────────────
// Used inside SliverAppBar which handles safe area automatically.
class _RoomsHeaderContent extends StatelessWidget {
  final RoomDashboardData data;
  final _ViewMode viewMode;
  final Animation<double> pulseAnim;
  final ValueChanged<_ViewMode> onViewModeChanged;
  final VoidCallback onRefresh;

  const _RoomsHeaderContent({
    required this.data,
    required this.viewMode,
    required this.pulseAnim,
    required this.onViewModeChanged,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Row(
        children: [
          // Left: property label + title row
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  data.property.name.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.8,
                    color: _textMuted,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    AnimatedBuilder(
                      animation: pulseAnim,
                      builder: (context, child) => Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _statusReady.withValues(alpha: pulseAnim.value),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'ROOMS',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: _textPrimary,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: _gold.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: _gold.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        '${data.overview.total} total',
                        style: const TextStyle(
                          color: _gold,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // View mode toggle
          Container(
            decoration: BoxDecoration(
              color: _surfaceRaised,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ViewToggleBtn(
                  icon: Icons.view_list_rounded,
                  selected: viewMode == _ViewMode.list,
                  onTap: () => onViewModeChanged(_ViewMode.list),
                ),
                Container(width: 1, height: 24, color: _border),
                _ViewToggleBtn(
                  icon: Icons.grid_view_rounded,
                  selected: viewMode == _ViewMode.grid,
                  onTap: () => onViewModeChanged(_ViewMode.grid),
                ),
              ],
            ),
          ),

          const SizedBox(width: 8),

          // Refresh button
          GestureDetector(
            onTap: onRefresh,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _surfaceRaised,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _border),
              ),
              child: const Icon(Icons.refresh_rounded, color: _textSecondary, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}

class _ViewToggleBtn extends StatelessWidget {
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ViewToggleBtn({
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: selected ? _gold.withValues(alpha: 0.12) : Colors.transparent,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Icon(icon, color: selected ? _gold : _textMuted, size: 18),
    ),
  );
}

// ─── Analytics Mini Bar ───────────────────────────────────────────────────────
class _AnalyticsMiniBar extends StatelessWidget {
  final RoomOverview overview;
  final RoomDashboardData snapshot;

  const _AnalyticsMiniBar({required this.overview, required this.snapshot});

  @override
  Widget build(BuildContext context) {
    final occPct = overview.total > 0
        ? (overview.occupied / overview.total * 100)
        : 0.0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F1B2D), Color(0xFF0A1320)],
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _borderHigh),
          boxShadow: [
            BoxShadow(
              color: _gold.withValues(alpha: 0.04),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            // Occupancy big number + stats
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Big occupancy %
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'OCCUPANCY',
                      style: TextStyle(
                        color: _textMuted,
                        fontSize: 9,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${occPct.toStringAsFixed(0)}%',
                          style: const TextStyle(
                            color: _textPrimary,
                            fontSize: 38,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1,
                            height: 1,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            '${overview.occupied}/${overview.total} rooms',
                            style: const TextStyle(
                              color: _textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const Spacer(),
                // Quick stat pills
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _QuickStatPill(
                      label: 'Available',
                      value: '${overview.ready}',
                      color: _statusReady,
                    ),
                    const SizedBox(height: 6),
                    _QuickStatPill(
                      label: 'OOO/OOS',
                      value: '${overview.outOfOrder + overview.outOfService}',
                      color: _statusOOO,
                    ),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Occupancy bar
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Stack(
                children: [
                  Container(height: 8, color: _surface),
                  FractionallySizedBox(
                    widthFactor: overview.total > 0 ? overview.occupied / overview.total : 0,
                    child: Container(
                      height: 8,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: occPct >= 80
                              ? [_statusReady, const Color(0xFF059669)]
                              : occPct >= 50
                                  ? [_statusOccupied, const Color(0xFF2563EB)]
                                  : [_statusDirty, const Color(0xFFEA580C)],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // Status breakdown row
            Row(
              children: [
                _StatusStat(value: overview.occupied, label: 'Occupied', color: _statusOccupied),
                _vDivider(),
                _StatusStat(value: overview.ready, label: 'Ready', color: _statusReady),
                _vDivider(),
                _StatusStat(value: overview.dirty + overview.occupiedDirty, label: 'Dirty', color: _statusDirty),
                _vDivider(),
                _StatusStat(value: overview.outOfOrder + overview.outOfService, label: 'OOO/OOS', color: _statusOOO),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _vDivider() => Container(
    width: 1,
    height: 32,
    color: _border,
    margin: const EdgeInsets.symmetric(horizontal: 8),
  );
}

class _QuickStatPill extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _QuickStatPill({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color.withValues(alpha: 0.25)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: color.withValues(alpha: 0.7),
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _StatusStat extends StatelessWidget {
  final int value;
  final String label;
  final Color color;
  const _StatusStat({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          '$value',
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(color: _textMuted, fontSize: 9, letterSpacing: 0.3),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
class _FilterBar extends StatelessWidget {
  final String selected;
  final RoomOverview overview;
  final ValueChanged<String> onSelect;
  final List<RoomItem> rooms;
  final bool Function(RoomItem) isStayoverDirty;

  const _FilterBar({
    required this.selected,
    required this.overview,
    required this.onSelect,
    required this.rooms,
    required this.isStayoverDirty,
  });

  static const _filters = [
    ('ALL',      'All',       null),
    ('OCCUPIED', 'Occupied',  _statusOccupied),
    ('READY',    'Ready',     _statusReady),
    ('DIRTY',    'Dirty',     _statusDirty),
    ('OOO',      'OOO',       _statusOOO),
    ('OOS',      'OOS',       _statusOOS),
  ];

  int _count(String f) {
    switch (f) {
      case 'OCCUPIED': return overview.occupied;
      case 'READY':    return overview.ready;
      case 'DIRTY':    return overview.dirty + overview.occupiedDirty;
      case 'OOO':      return overview.outOfOrder;
      case 'OOS':      return overview.outOfService;
      default:         return overview.total;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: _filters.map((rec) {
          final (id, label, color) = rec;
          final isSelected = id == selected;
          final count = _count(id);
          final activeColor = color ?? _gold;

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onSelect(id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  color: isSelected
                      ? activeColor.withValues(alpha: 0.12)
                      : _surfaceRaised,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                    color: isSelected ? activeColor : _border,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (color != null) ...[
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isSelected ? color : _textMuted,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? activeColor : _textSecondary,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? activeColor.withValues(alpha: 0.2)
                            : _surface,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$count',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? activeColor : _textMuted,
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

// ─── Premium Room Card (List View) ────────────────────────────────────────────
class _PremiumRoomCard extends StatelessWidget {
  final RoomItem room;
  final Color statusColor;
  final String statusLabel;
  final bool isStayoverDirty;
  final VoidCallback onTap;

  const _PremiumRoomCard({
    required this.room,
    required this.statusColor,
    required this.statusLabel,
    required this.isStayoverDirty,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    String displayNumber = room.number;
    String? locationText;
    if (room.number.contains('.')) {
      final parts = room.number.split('.');
      if (parts.length >= 3) {
        displayNumber = parts.last;
        locationText = 'Bldg ${parts[0]} · Flr ${parts[1]}';
      }
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: _surfaceRaised,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: statusColor.withValues(alpha: 0.18)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Left status stripe
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [statusColor, statusColor.withValues(alpha: 0.4)],
                  ),
                ),
              ),

              // ── Card content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Room number + type + location
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Text(
                                  displayNumber,
                                  style: const TextStyle(
                                    fontSize: 30,
                                    fontWeight: FontWeight.w900,
                                    color: _textPrimary,
                                    letterSpacing: -0.5,
                                    height: 1,
                                  ),
                                ),
                                if (locationText != null) ...[
                                  const SizedBox(width: 10),
                                  Text(
                                    locationText,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: _textMuted,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 5),
                            Text(
                              room.roomType.name,
                              style: const TextStyle(
                                fontSize: 12,
                                color: _textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (room.contextualNote != null &&
                                room.contextualNote!.isNotEmpty) ...[
                              const SizedBox(height: 5),
                              Row(
                                children: [
                                  Icon(
                                    isStayoverDirty
                                        ? Icons.cleaning_services_rounded
                                        : Icons.info_outline_rounded,
                                    size: 11,
                                    color: statusColor.withValues(alpha: 0.7),
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      room.contextualNote!,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: statusColor.withValues(alpha: 0.8),
                                        fontStyle: FontStyle.italic,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),

                      // Right: status badge + HK badge
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Status badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: statusColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: statusColor.withValues(alpha: 0.35)),
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
                          // HK badge for stayover dirty
                          if (isStayoverDirty)
                            Container(
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                color: _statusStayDirty.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: _statusStayDirty.withValues(alpha: 0.3)),
                              ),
                              child: const Icon(
                                Icons.cleaning_services_rounded,
                                size: 11,
                                color: _statusStayDirty,
                              ),
                            )
                          else
                            const Icon(
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

// ─── Grid Tile ────────────────────────────────────────────────────────────────
class _RoomGridTile extends StatelessWidget {
  final RoomItem room;
  final Color statusColor;
  final String statusLabel;
  final bool isStayoverDirty;
  final VoidCallback onTap;

  const _RoomGridTile({
    required this.room,
    required this.statusColor,
    required this.statusLabel,
    required this.isStayoverDirty,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    String displayNumber = room.number;
    if (room.number.contains('.')) {
      final parts = room.number.split('.');
      if (parts.length >= 3) displayNumber = parts.last;
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: _surfaceRaised,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: statusColor.withValues(alpha: 0.3)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Status dot
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: statusColor.withValues(alpha: 0.5),
                    blurRadius: 6,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            // Room number
            Text(
              displayNumber,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: _textPrimary,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            // Type (truncated)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                room.roomType.name,
                style: const TextStyle(fontSize: 9, color: _textMuted),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 8),
            // Status label
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 6),
              padding: const EdgeInsets.symmetric(vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Center(
                child: Text(
                  statusLabel.split(' · ').last,
                  style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
class _SkeletonBar extends StatefulWidget {
  final double height;
  const _SkeletonBar({required this.height});

  @override
  State<_SkeletonBar> createState() => _SkeletonBarState();
}

class _SkeletonBarState extends State<_SkeletonBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<Color?> _colorAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _colorAnim = ColorTween(
      begin: const Color(0xFF0D1422),
      end: const Color(0xFF172030),
    ).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _colorAnim,
    builder: (ctx, child) => Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: _colorAnim.value,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:intl/intl.dart';

import '../providers/rooms_provider.dart';
import '../models/room_data.dart';

// ─── Design System ────────────────────────────────────────────────────────────
const _bg           = Color(0xFF060B14);
const _bgGradTop    = Color(0xFF0B1526);
const _surface      = Color(0xFF0D1422);
const _surfaceRaised = Color(0xFF111D30);
const _surfaceHigh  = Color(0xFF172038);
const _border       = Color(0xFF1E2D42);

const _gold         = Color(0xFFD4AF37);
const _textPrimary  = Color(0xFFF0F4FF);
const _textSecondary= Color(0xFF8B95B0);
const _textMuted    = Color(0xFF4A5468);
const _green        = Color(0xFF10B981);
const _blue         = Color(0xFF3B82F6);
const _orange       = Color(0xFFF59E0B);
const _red          = Color(0xFFEF4444);
const _violet       = Color(0xFF8B5CF6);

// ─── Room Details Screen ─────────────────────────────────────────────────────
class RoomDetailsScreen extends ConsumerStatefulWidget {
  final String roomId;
  const RoomDetailsScreen({super.key, required this.roomId});

  @override
  ConsumerState<RoomDetailsScreen> createState() => _RoomDetailsScreenState();
}

class _RoomDetailsScreenState extends ConsumerState<RoomDetailsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  bool _timelineExpanded = false;


  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(roomDetailsProvider(widget.roomId));

    return Scaffold(
      backgroundColor: _bg,
      extendBodyBehindAppBar: true,
      body: async.when(
        data: _buildBody,
        loading: _buildLoading,
        error: (e, _) => _buildError(e),
      ),
    );
  }

  Widget _buildBody(RoomDetailsData data) {
    final statusMeta = _statusMeta(data.room.displayStatus);
    final displayNumber = _parseRoomNumber(data.room.number);

    return Column(
      children: [
        // ── Hero Header ───────────────────────────────────────────────────
        _HeroHeader(
          data: data,
          statusMeta: statusMeta,
          displayNumber: displayNumber,
          onBack: () => Navigator.of(context).pop(),
        ),

        // ── Tab Bar ───────────────────────────────────────────────────────
        Container(
          color: _surface,
          child: TabBar(
            controller: _tabCtrl,
            labelColor: _gold,
            unselectedLabelColor: _textMuted,
            indicatorColor: _gold,
            indicatorWeight: 2,
            labelStyle: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
            tabs: const [
              Tab(text: 'ROOM STATUS'),
              Tab(text: 'HISTORY'),
            ],
          ),
        ),

        // ── Tab Views ─────────────────────────────────────────────────────
        Expanded(
          child: TabBarView(
            controller: _tabCtrl,
            children: [
              _OverviewTab(data: data),
              _HistoryTab(
                data: data,
                timelineExpanded: _timelineExpanded,
                onToggleTimeline: () =>
                    setState(() => _timelineExpanded = !_timelineExpanded),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: _gold, strokeWidth: 2),
          SizedBox(height: 16),
          Text('Loading room data…', style: TextStyle(color: _textSecondary, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildError(Object e) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _red.withValues(alpha: 0.08),
                shape: BoxShape.circle,
                border: Border.all(color: _red.withValues(alpha: 0.25)),
              ),
              child: const Icon(Icons.error_outline_rounded, color: _red, size: 40),
            ),
            const SizedBox(height: 20),
            const Text('Failed to load room', style: TextStyle(color: _textPrimary, fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(e.toString(), style: const TextStyle(color: _textSecondary, fontSize: 12), textAlign: TextAlign.center),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: () => ref.refresh(roomDetailsProvider(widget.roomId)),
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
      ),
    );
  }

  _StatusMeta _statusMeta(String status) {
    switch (status) {
      case 'OCCUPIED':       return _StatusMeta(_blue, Icons.person_rounded, 'Occupied');
      case 'READY':          return _StatusMeta(_green, Icons.check_circle_rounded, 'Vacant · Ready');
      case 'DIRTY':          return _StatusMeta(_orange, Icons.cleaning_services_rounded, 'Vacant · Dirty');
      case 'OUT_OF_ORDER':   return _StatusMeta(_red, Icons.block_rounded, 'Out of Order');
      case 'OUT_OF_SERVICE': return _StatusMeta(_violet, Icons.engineering_rounded, 'Out of Service');
      default:               return _StatusMeta(_textMuted, Icons.help_outline_rounded, status.replaceAll('_', ' '));
    }
  }

  String _parseRoomNumber(String number) {
    if (number.contains('.')) {
      final parts = number.split('.');
      if (parts.length >= 3) return parts.last;
    }
    return number;
  }
}

// ─── Hero Header ──────────────────────────────────────────────────────────────
class _HeroHeader extends StatelessWidget {
  final RoomDetailsData data;
  final _StatusMeta statusMeta;
  final String displayNumber;
  final VoidCallback onBack;

  const _HeroHeader({
    required this.data,
    required this.statusMeta,
    required this.displayNumber,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    String? locationText;
    if (data.room.number.contains('.')) {
      final parts = data.room.number.split('.');
      if (parts.length >= 3) {
        locationText = 'Building ${parts[0]} · Floor ${parts[1]}';
      }
    }

    return Container(
      padding: EdgeInsets.fromLTRB(20, topPad + 12, 20, 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _bgGradTop,
            statusMeta.color.withValues(alpha: 0.08),
          ],
        ),
        border: Border(
          bottom: BorderSide(color: statusMeta.color.withValues(alpha: 0.2)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Back + title row
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  onBack();
                },
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _surfaceHigh,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _border),
                  ),
                  child: const Icon(Icons.arrow_back_ios_new_rounded, color: _textSecondary, size: 15),
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'ROOM PROFILE',
                style: TextStyle(
                  color: _textMuted,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Room number + type
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (locationText != null) ...[
                      Text(
                        locationText,
                        style: const TextStyle(
                          color: _textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                    ],
                    Text(
                      data.room.roomType.name.toUpperCase(),
                      style: const TextStyle(
                        color: _textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'ROOM',
                    style: TextStyle(
                      color: _textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2.5,
                    ),
                  ),
                  Text(
                    displayNumber,
                    style: TextStyle(
                      color: _textPrimary,
                      fontSize: 52,
                      fontWeight: FontWeight.w900,
                      height: 1,
                      letterSpacing: -1,
                      shadows: [
                        Shadow(
                          color: statusMeta.color.withValues(alpha: 0.4),
                          blurRadius: 20,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Status + sellability row
          Row(
            children: [
              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: statusMeta.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusMeta.color.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusMeta.icon, color: statusMeta.color, size: 12),
                    const SizedBox(width: 6),
                    Text(
                      statusMeta.label,
                      style: TextStyle(
                        color: statusMeta.color,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Sellability badge
              _SellabilityBadge(sellability: data.sellability),
              const Spacer(),
              // Management attention indicator
              if (data.managementAttention != null)
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: _red.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _red.withValues(alpha: 0.3)),
                  ),
                  child: const Icon(
                    Icons.warning_amber_rounded,
                    color: _red,
                    size: 16,
                  ),
                ),
            ],
          ),

          // Management attention banner
          if (data.managementAttention != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              decoration: BoxDecoration(
                color: _red.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _red.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: _red, size: 14),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      data.managementAttention!.message,
                      style: const TextStyle(
                        color: _red,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
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
}

class _SellabilityBadge extends StatelessWidget {
  final String sellability;
  const _SellabilityBadge({required this.sellability});

  @override
  Widget build(BuildContext context) {
    final (color, icon, label) = switch (sellability) {
      'READY_TO_SELL' => (_green, Icons.check_circle_outline_rounded, 'SELLABLE'),
      'NOT_SELLABLE'  => (_red, Icons.block_rounded, 'NOT SELLABLE'),
      _               => (_orange, Icons.pending_outlined, 'NOT READY'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 11),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
class _OverviewTab extends StatelessWidget {
  final RoomDetailsData data;
  const _OverviewTab({required this.data});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      children: [
        _CurrentGuestCard(guest: data.currentGuest),
        const SizedBox(height: 12),
        _NextArrivalCard(arrival: data.nextArrival),
        const SizedBox(height: 12),
        _HousekeepingCard(hk: data.housekeeping),
        if (data.maintenance != null) ...[
          const SizedBox(height: 12),
          _MaintenanceCard(maintenance: data.maintenance!),
        ],
      ],
    );
  }
}

// ─── History Tab ─────────────────────────────────────────────────────────────
class _HistoryTab extends StatelessWidget {
  final RoomDetailsData data;
  final bool timelineExpanded;
  final VoidCallback onToggleTimeline;

  const _HistoryTab({
    required this.data,
    required this.timelineExpanded,
    required this.onToggleTimeline,
  });

  @override
  Widget build(BuildContext context) {
    const previewCount = 3;
    final hasMore = data.timeline.length > previewCount;
    final displayed = timelineExpanded
        ? data.timeline
        : data.timeline.take(previewCount).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      children: [
        _SectionHeader(
          icon: Icons.timeline_rounded,
          title: 'ROOM ACTIVITY',
          subtitle: '${data.timeline.length} events',
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _surfaceRaised,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _border),
          ),
          child: Column(
            children: [
              if (displayed.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Text(
                      'No recent activity recorded',
                      style: TextStyle(color: _textMuted, fontSize: 13),
                    ),
                  ),
                )
              else
                ...displayed.asMap().entries.map(
                  (e) => _TimelineEntry(
                    event: e.value,
                    isLast: e.key == displayed.length - 1,
                  ),
                ),

              if (hasMore) ...[
                const SizedBox(height: 4),
                Divider(color: _border, height: 1),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: onToggleTimeline,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          timelineExpanded
                              ? 'Show less'
                              : 'View ${data.timeline.length - previewCount} more events',
                          style: const TextStyle(
                            color: _blue,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          timelineExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          color: _blue,
                          size: 16,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),

        // Business date footnote
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.calendar_today_outlined, color: _textMuted, size: 12),
            const SizedBox(width: 6),
            Text(
              'Business Date: ${DateFormat('EEE, MMM d · yyyy').format(data.businessDate)}',
              style: const TextStyle(color: _textMuted, fontSize: 11),
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Cards ───────────────────────────────────────────────────────────────────

class _CurrentGuestCard extends StatelessWidget {
  final CurrentGuestInfo? guest;
  const _CurrentGuestCard({required this.guest});

  @override
  Widget build(BuildContext context) {
    if (guest == null) {
      return _InfoCard(
        icon: Icons.person_outline_rounded,
        iconColor: _textMuted,
        title: 'CURRENT GUEST',
        trailing: null,
        child: const _EmptyState(message: 'Room is unoccupied'),
      );
    }

    final fmt = DateFormat('MMM d');
    final nights = guest!.checkOut.difference(guest!.checkIn).inDays;
    final now = DateTime.now();
    final daysLeft = guest!.checkOut.difference(now).inDays;

    return _InfoCard(
      icon: Icons.person_rounded,
      iconColor: _blue,
      title: 'CURRENT GUEST',
      trailing: guest!.vipLevel != null
          ? _Chip(label: guest!.vipLevel!, color: _gold)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            guest!.name ?? '🔒 Restricted',
            style: const TextStyle(
              color: _textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          // Check-in / Check-out
          _InfoGrid(items: [
            _InfoItem(Icons.login_rounded, 'Check-In', fmt.format(guest!.checkIn)),
            _InfoItem(Icons.logout_rounded, 'Check-Out', fmt.format(guest!.checkOut)),
            _InfoItem(Icons.nights_stay_rounded, 'Nights', '$nights'),
            _InfoItem(
              Icons.timer_outlined,
              'Remaining',
              daysLeft < 0
                  ? 'Overdue'
                  : daysLeft == 0
                      ? 'Departing today'
                      : '$daysLeft day${daysLeft == 1 ? '' : 's'}',
            ),
          ]),
          if (guest!.folioBalance != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _surfaceHigh,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long_rounded, size: 14, color: _textMuted),
                  const SizedBox(width: 8),
                  const Text(
                    'Folio Balance',
                    style: TextStyle(color: _textSecondary, fontSize: 12),
                  ),
                  const Spacer(),
                  Text(
                    '₦${guest!.folioBalance!.toStringAsFixed(2)}',
                    style: TextStyle(
                      color: guest!.folioBalance! > 0 ? _orange : _green,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
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
}

class _NextArrivalCard extends StatelessWidget {
  final NextArrivalInfo? arrival;
  const _NextArrivalCard({required this.arrival});

  @override
  Widget build(BuildContext context) {
    if (arrival == null) {
      return _InfoCard(
        icon: Icons.flight_land_outlined,
        iconColor: _textMuted,
        title: 'NEXT ARRIVAL',
        trailing: null,
        child: const _EmptyState(message: 'No upcoming arrivals scheduled'),
      );
    }

    final dateFmt = DateFormat('EEE, MMM d');
    final now = DateTime.now();
    final isToday = arrival!.arrivalDate.year == now.year &&
        arrival!.arrivalDate.month == now.month &&
        arrival!.arrivalDate.day == now.day;
    final dateStr = isToday ? 'Today' : dateFmt.format(arrival!.arrivalDate);

    return _InfoCard(
      icon: Icons.flight_land_rounded,
      iconColor: _green,
      title: 'NEXT ARRIVAL',
      trailing: isToday ? _Chip(label: 'TODAY', color: _orange) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            arrival!.guestName ?? '🔒 Restricted',
            style: const TextStyle(
              color: _textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          _InfoGrid(items: [
            _InfoItem(Icons.calendar_today_outlined, 'Arrival', dateStr),
            if (arrival!.arrivalTime != null)
              _InfoItem(Icons.schedule_rounded, 'ETA', arrival!.arrivalTime!),
            _InfoItem(Icons.nights_stay_rounded, 'Nights', '${arrival!.nights}'),
            _InfoItem(Icons.info_outline_rounded, 'Status', _capitalize(arrival!.status)),
          ]),
        ],
      ),
    );
  }
}

class _HousekeepingCard extends StatelessWidget {
  final HousekeepingInfo hk;
  const _HousekeepingCard({required this.hk});

  @override
  Widget build(BuildContext context) {
    final isClean = hk.status == 'CLEAN' || hk.status == 'INSPECTED';
    final color = isClean ? _green : _orange;

    return _InfoCard(
      icon: Icons.cleaning_services_rounded,
      iconColor: color,
      title: 'HOUSEKEEPING',
      trailing: _Chip(label: hk.status, color: color),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hk.lastUpdatedAt != null)
            _DetailRow(
              icon: Icons.update_rounded,
              label: hk.status == 'INSPECTED' ? 'Last Inspected' : 'Last Updated',
              value: timeago.format(hk.lastUpdatedAt!),
            ),
          if (hk.assignedTo != null) ...[
            const SizedBox(height: 8),
            _DetailRow(
              icon: Icons.badge_rounded,
              label: 'Assigned To',
              value: hk.assignedTo!,
            ),
          ],
          if (hk.lastUpdatedAt == null && hk.assignedTo == null)
            const _EmptyState(message: 'No housekeeping activity recorded'),
        ],
      ),
    );
  }
}

class _MaintenanceCard extends StatelessWidget {
  final MaintenanceInfo maintenance;
  const _MaintenanceCard({required this.maintenance});

  @override
  Widget build(BuildContext context) {
    return _InfoCard(
      icon: Icons.build_rounded,
      iconColor: _red,
      title: 'MAINTENANCE',
      trailing: _Chip(
        label: maintenance.status.replaceAll('_', ' '),
        color: _red,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Reason banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _red.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _red.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.report_problem_rounded, color: _red, size: 15),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    maintenance.reason,
                    style: const TextStyle(color: _textPrimary, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (maintenance.priority.isNotEmpty)
            _DetailRow(
              icon: Icons.flag_rounded,
              label: 'Priority',
              value: maintenance.priority,
            ),
          if (maintenance.reportedAt != null) ...[
            const SizedBox(height: 8),
            _DetailRow(
              icon: Icons.schedule_rounded,
              label: 'Reported',
              value: timeago.format(maintenance.reportedAt!),
            ),
          ],
          if (maintenance.expectedResolutionAt != null) ...[
            const SizedBox(height: 8),
            _DetailRow(
              icon: Icons.event_available_rounded,
              label: 'Expected Resolution',
              value: DateFormat('MMM d · HH:mm').format(maintenance.expectedResolutionAt!),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Timeline Entry ───────────────────────────────────────────────────────────
class _TimelineEntry extends StatelessWidget {
  final TimelineEvent event;
  final bool isLast;

  const _TimelineEntry({required this.event, required this.isLast});

  Color _color() {
    switch (event.type) {
      case 'MAINTENANCE':  return _red;
      case 'HOUSEKEEPING': return _orange;
      case 'RESERVATION':  return _blue;
      default:             return _textSecondary;
    }
  }

  IconData _icon() {
    switch (event.type) {
      case 'MAINTENANCE':  return Icons.build_rounded;
      case 'HOUSEKEEPING': return Icons.cleaning_services_rounded;
      case 'RESERVATION':  return Icons.hotel_rounded;
      default:             return Icons.info_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color();
    final icon = _icon();
    final fmt = DateFormat('MMM d · HH:mm');

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Dot + line
          Column(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withValues(alpha: 0.3)),
                ),
                child: Icon(icon, color: color, size: 14),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 1.5,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: _border,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          // Content
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    fmt.format(event.timestamp),
                    style: TextStyle(
                      color: color,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    event.title,
                    style: const TextStyle(
                      color: _textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (event.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      event.subtitle,
                      style: const TextStyle(color: _textSecondary, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Shared building blocks ───────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;

  const _SectionHeader({
    required this.icon,
    required this.title,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: _surfaceHigh,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _border),
          ),
          child: Icon(icon, color: _textSecondary, size: 14),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(
            color: _textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(width: 8),
          Text(
            subtitle!,
            style: const TextStyle(color: _textMuted, fontSize: 11),
          ),
        ],
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final Widget? trailing;
  final Widget child;

  const _InfoCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.trailing,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _surfaceRaised,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: iconColor, size: 14),
                ),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    color: _textSecondary,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const Spacer(),
                ?trailing,
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Divider(height: 1, color: _border),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  final List<_InfoItem> items;
  const _InfoGrid({required this.items});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((item) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: _surfaceHigh,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(item.icon, color: _textMuted, size: 13),
            const SizedBox(width: 6),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.label, style: const TextStyle(color: _textMuted, fontSize: 10)),
                Text(
                  item.value,
                  style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      )).toList(),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: _textMuted, size: 14),
      const SizedBox(width: 8),
      Text('$label:', style: const TextStyle(color: _textSecondary, fontSize: 13)),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          value,
          style: const TextStyle(
            color: _textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ],
  );
}

class _EmptyState extends StatelessWidget {
  final String message;
  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Text(
      message,
      style: const TextStyle(color: _textMuted, fontSize: 13),
    ),
  );
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: color.withValues(alpha: 0.35)),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: color,
        fontSize: 9,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.5,
      ),
    ),
  );
}

// ─── Data helpers ─────────────────────────────────────────────────────────────
class _StatusMeta {
  final Color color;
  final IconData icon;
  final String label;
  const _StatusMeta(this.color, this.icon, this.label);
}

class _InfoItem {
  final IconData icon;
  final String label;
  final String value;
  const _InfoItem(this.icon, this.label, this.value);
}

String _capitalize(String s) {
  if (s.isEmpty) return s;
  return s[0].toUpperCase() + s.substring(1).toLowerCase().replaceAll('_', ' ');
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:intl/intl.dart';

import '../providers/rooms_provider.dart';
import '../models/room_data.dart';

class RoomDetailsScreen extends ConsumerStatefulWidget {
  final String roomId;
  const RoomDetailsScreen({super.key, required this.roomId});

  @override
  ConsumerState<RoomDetailsScreen> createState() => _RoomDetailsScreenState();
}

class _RoomDetailsScreenState extends ConsumerState<RoomDetailsScreen> {
  bool _timelineExpanded = false;
  static const int _timelinePreviewCount = 3;

  // Design tokens
  static const _navy       = Color(0xFF0B1120);
  static const _surface    = Color(0xFF141E30);
  static const _card       = Color(0xFF1A2540);
  static const _border     = Color(0xFF263352);
  static const _textPrimary   = Color(0xFFE2E8F0);
  static const _textSecondary = Color(0xFF94A3B8);
  static const _textMuted     = Color(0xFF475569);
  static const _gold       = Color(0xFFD4AF37);
  static const _green      = Color(0xFF10B981);
  static const _orange     = Color(0xFFF59E0B);
  static const _red        = Color(0xFFEF4444);
  static const _blue       = Color(0xFF3B82F6);

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(roomDetailsProvider(widget.roomId));

    return Scaffold(
      backgroundColor: _navy,
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(),
      body: async.when(
        data:    (data)  => _buildBody(data),
        loading: ()      => _buildLoading(),
        error:   (e, _)  => _buildError(e),
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Container(
          margin: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _card.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _border),
          ),
          child: const Icon(Icons.arrow_back_ios_new, color: _textPrimary, size: 16),
        ),
      ),
      title: const Text(
        'Room Intelligence',
        style: TextStyle(color: _textSecondary, fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: 0.5),
      ),
      centerTitle: true,
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: _blue, strokeWidth: 2),
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
                color: _red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _red.withValues(alpha: 0.3)),
              ),
              child: const Icon(Icons.error_outline, color: _red, size: 40),
            ),
            const SizedBox(height: 20),
            const Text('Failed to load room', style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(e.toString(), style: const TextStyle(color: _textSecondary, fontSize: 12), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Retry'),
              onPressed: () => ref.refresh(roomDetailsProvider(widget.roomId)),
              style: OutlinedButton.styleFrom(
                foregroundColor: _textPrimary,
                side: const BorderSide(color: _border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(RoomDetailsData data) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeroHeader(data),
          _buildManagementAttentionBanner(data.managementAttention),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 20),
                _buildSellabilityBanner(data),
                const SizedBox(height: 16),
                _buildGuestCard(data.currentGuest),
                const SizedBox(height: 16),
                _buildNextArrivalCard(data.nextArrival),
                const SizedBox(height: 16),
                _buildHousekeepingCard(data.housekeeping),
                if (data.maintenance != null) ...[
                  const SizedBox(height: 16),
                  _buildMaintenanceCard(data.maintenance!),
                ],
                const SizedBox(height: 16),
                _buildTimelineCard(data.timeline),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildManagementAttentionBanner(ManagementAttention? attention) {
    if (attention == null) return const SizedBox.shrink();
    final color = attention.type == 'CRITICAL' ? _red : _orange;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(attention.type == 'CRITICAL' ? Icons.warning_amber_rounded : Icons.info_outline, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              attention.message,
              style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Hero Header ────────────────────────────────────────────────────────────

  Widget _buildHeroHeader(RoomDetailsData data) {
    final (statusColor, statusBg, statusIcon) = _statusMeta(data.room.displayStatus);
    final dateFormat = DateFormat('EEE, MMM d · yyyy');

    String displayRoomNumber = data.room.number;
    String? locationSubText;
    if (data.room.number.contains('.')) {
      final parts = data.room.number.split('.');
      if (parts.length >= 3) {
        displayRoomNumber = parts.last;
        locationSubText = 'Building ${parts[0]} · Floor ${parts[1]}';
      }
    }

    return Container(
      padding: EdgeInsets.fromLTRB(24, MediaQuery.of(context).padding.top + 40, 24, 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _surface,
            statusBg.withValues(alpha: 0.15),
          ],
        ),
        border: Border(bottom: BorderSide(color: _border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Room number + type
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'ROOM',
                style: TextStyle(color: _textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 2),
              ),
              const SizedBox(width: 8),
              Text(
                displayRoomNumber,
                style: const TextStyle(color: _textPrimary, fontSize: 40, fontWeight: FontWeight.bold, height: 1),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (locationSubText != null) ...[
            Text(locationSubText, style: const TextStyle(color: _textSecondary, fontSize: 13)),
            const SizedBox(height: 4),
          ],
          Text(data.room.roomType.name, style: const TextStyle(color: _textSecondary, fontSize: 15)),
          const SizedBox(height: 16),
          // Status badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: statusBg.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: statusColor.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, color: statusColor, size: 13),
                const SizedBox(width: 6),
                Text(
                  data.room.displayStatus.replaceAll('_', ' '),
                  style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Business date
          Row(
            children: [
              const Icon(Icons.calendar_today, color: _textMuted, size: 12),
              const SizedBox(width: 6),
              Text(
                'Business Date: ${dateFormat.format(data.businessDate)}',
                style: const TextStyle(color: _textMuted, fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Sellability Banner ──────────────────────────────────────────────────────

  Widget _buildSellabilityBanner(RoomDetailsData data) {
    final Color color;
    final String label;
    final String sublabel;
    final IconData icon;

    switch (data.sellability) {
      case 'READY_TO_SELL':
        color = _green; label = 'READY TO SELL'; sublabel = 'Available for new bookings';
        icon = Icons.check_circle_outline;
        break;
      case 'NOT_SELLABLE':
        color = _red; label = 'NOT SELLABLE'; sublabel = data.maintenance?.reason ?? 'Out of Order / Service';
        icon = Icons.block;
        break;
      default:
        color = _orange; label = 'NOT READY';
        sublabel = data.room.displayStatus == 'OCCUPIED' ? 'Currently occupied' : 'Housekeeping: ${data.housekeeping.status}';
        icon = Icons.pending_outlined;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.5)),
              Text(sublabel, style: TextStyle(color: color.withValues(alpha: 0.7), fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Guest Card ──────────────────────────────────────────────────────────────

  Widget _buildGuestCard(CurrentGuestInfo? guest) {
    if (guest == null) {
      return _buildCard(
        icon: Icons.person_outline,
        iconColor: _textMuted,
        title: 'CURRENT GUEST',
        child: const _EmptyState(message: 'No guest currently in-house'),
      );
    }

    final fmt = DateFormat('MMM d');
    final nights = guest.checkOut.difference(guest.checkIn).inDays;

    return _buildCard(
      icon: Icons.person,
      iconColor: _blue,
      title: 'CURRENT GUEST',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  guest.name ?? '🔒 Guest details restricted',
                  style: const TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              if (guest.vipLevel != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: _gold.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6), border: Border.all(color: _gold.withValues(alpha: 0.4))),
                  child: Text(guest.vipLevel!, style: const TextStyle(color: _gold, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          _buildInfoGrid([
            _InfoItem(Icons.login, 'Check-In', fmt.format(guest.checkIn)),
            _InfoItem(Icons.logout, 'Check-Out', fmt.format(guest.checkOut)),
            _InfoItem(Icons.nights_stay, 'Nights', '$nights'),
            if (guest.folioBalance != null)
              _InfoItem(Icons.receipt_long, 'Balance', '\$${guest.folioBalance!.toStringAsFixed(2)}'),
          ]),
        ],
      ),
    );
  }

  // ─── Next Arrival Card ───────────────────────────────────────────────────────

  Widget _buildNextArrivalCard(NextArrivalInfo? arrival) {
    if (arrival == null) {
      return _buildCard(
        icon: Icons.flight_land_outlined,
        iconColor: _textMuted,
        title: 'NEXT ARRIVAL',
        child: const _EmptyState(message: 'No upcoming arrivals'),
      );
    }

    final dateFmt = DateFormat('EEE, MMM d');
    final isToday = arrival.arrivalDate.year == DateTime.now().year &&
        arrival.arrivalDate.month == DateTime.now().month &&
        arrival.arrivalDate.day == DateTime.now().day;
    final dateStr = isToday ? 'Today' : dateFmt.format(arrival.arrivalDate);

    return _buildCard(
      icon: Icons.flight_land,
      iconColor: _blue,
      title: 'NEXT ARRIVAL',
      chip: isToday ? _Chip(label: 'TODAY', color: _orange) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            arrival.guestName ?? '🔒 Guest details restricted',
            style: const TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          _buildInfoGrid([
            _InfoItem(Icons.calendar_today, 'Arrival', dateStr),
            if (arrival.arrivalTime != null)
              _InfoItem(Icons.schedule, 'ETA', arrival.arrivalTime!),
            _InfoItem(Icons.nights_stay, 'Nights', '${arrival.nights}'),
            _InfoItem(Icons.info_outline, 'Status', _capitalize(arrival.status)),
          ]),
        ],
      ),
    );
  }

  // ─── Housekeeping Card ───────────────────────────────────────────────────────

  Widget _buildHousekeepingCard(HousekeepingInfo hk) {
    final isClean = hk.status == 'CLEAN' || hk.status == 'INSPECTED';
    final color = isClean ? _green : _orange;
    final icon = isClean ? Icons.check_circle : Icons.cleaning_services;

    return _buildCard(
      icon: icon,
      iconColor: color,
      title: 'HOUSEKEEPING',
      chip: _Chip(label: hk.status, color: color),
      child: Column(
        children: [
          if (hk.lastUpdatedAt != null)
            _buildInfoRow(
              Icons.update, 
              hk.status == 'INSPECTED' ? 'Last Inspected' : 'Last Updated', 
              timeago.format(hk.lastUpdatedAt!)
            ),
          if (hk.assignedTo != null) ...[
            const SizedBox(height: 8),
            _buildInfoRow(Icons.badge, 'Assigned To', hk.assignedTo!),
          ],
          if (hk.lastUpdatedAt == null && hk.assignedTo == null)
            const _EmptyState(message: 'No housekeeping activity recorded'),
        ],
      ),
    );
  }

  // ─── Maintenance Card ────────────────────────────────────────────────────────

  Widget _buildMaintenanceCard(MaintenanceInfo m) {
    return _buildCard(
      icon: Icons.build,
      iconColor: _red,
      title: 'MAINTENANCE',
      chip: _Chip(label: m.status.replaceAll('_', ' '), color: _red),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _red.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _red.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.report_problem, color: _red, size: 16),
                const SizedBox(width: 8),
                Expanded(child: Text(m.reason, style: const TextStyle(color: _textPrimary, fontSize: 13))),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (m.reportedAt != null)
            _buildInfoRow(Icons.flag, 'Reported', timeago.format(m.reportedAt!)),
          if (m.expectedResolutionAt != null) ...[
            const SizedBox(height: 8),
            _buildInfoRow(
              Icons.event_available,
              'Expected Resolution',
              DateFormat('MMM d · HH:mm').format(m.expectedResolutionAt!),
            ),
          ],
          if (m.priority.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildInfoRow(Icons.priority_high, 'Priority', m.priority),
          ],
        ],
      ),
    );
  }

  // ─── Timeline Card ───────────────────────────────────────────────────────────

  Widget _buildTimelineCard(List<TimelineEvent> timeline) {
    final hasMore = timeline.length > _timelinePreviewCount;
    final displayed = _timelineExpanded ? timeline : timeline.take(_timelinePreviewCount).toList();

    return _buildCard(
      icon: Icons.timeline,
      iconColor: _blue,
      title: 'ROOM TIMELINE',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (displayed.isEmpty)
            const _EmptyState(message: 'No recent room activity')
          else
            ...displayed.asMap().entries.map((e) => _buildTimelineEntry(e.value, isLast: e.key == displayed.length - 1)),
          if (hasMore) ...[
            const SizedBox(height: 4),
            GestureDetector(
              onTap: () => setState(() => _timelineExpanded = !_timelineExpanded),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: _border)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _timelineExpanded
                          ? 'Show less'
                          : 'View ${timeline.length - _timelinePreviewCount} more',
                      style: const TextStyle(color: _blue, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      _timelineExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      color: _blue, size: 16,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTimelineEntry(TimelineEvent event, {required bool isLast}) {
    final color = _timelineColor(event.type);
    final icon  = _timelineIcon(event.type);
    final fmt   = DateFormat('MMM d · HH:mm');

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Line + dot
          Column(
            children: [
              Container(
                width: 28, height: 28,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),
                child: Icon(icon, color: color, size: 13),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 1.5, color: _border, margin: const EdgeInsets.symmetric(vertical: 4)),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(fmt.format(event.timestamp), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(event.title, style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                  if (event.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(event.subtitle, style: const TextStyle(color: _textSecondary, fontSize: 12)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Shared helpers ──────────────────────────────────────────────────────────

  Widget _buildCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required Widget child,
    _Chip? chip,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Card header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                  child: Icon(icon, color: iconColor, size: 14),
                ),
                const SizedBox(width: 8),
                Text(title, style: const TextStyle(color: _textSecondary, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
                const Spacer(),
                if (chip != null) chip,
              ],
            ),
          ),
          // Divider
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Divider(height: 1, color: _border),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _buildInfoGrid(List<_InfoItem> items) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((item) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: _surface,
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
                Text(item.value, style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      )).toList(),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, color: _textMuted, size: 14),
        const SizedBox(width: 8),
        Text('$label:', style: const TextStyle(color: _textSecondary, fontSize: 13)),
        const SizedBox(width: 6),
        Expanded(child: Text(value, style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w500))),
      ],
    );
  }

  // ─── Status meta helpers ─────────────────────────────────────────────────────

  (Color, Color, IconData) _statusMeta(String status) {
    switch (status) {
      case 'OCCUPIED':        return (_blue, _blue, Icons.person);
      case 'READY':           return (_green, _green, Icons.check_circle);
      case 'DIRTY':           return (_orange, _orange, Icons.cleaning_services);
      case 'OUT_OF_ORDER':    return (_red, _red, Icons.block);
      case 'OUT_OF_SERVICE':  return (_red, _red, Icons.engineering);
      default:                return (_textMuted, _textMuted, Icons.help_outline);
    }
  }

  Color _timelineColor(String type) {
    switch (type) {
      case 'MAINTENANCE':   return _red;
      case 'HOUSEKEEPING':  return _orange;
      case 'RESERVATION':   return _blue;
      default:              return _textSecondary;
    }
  }

  IconData _timelineIcon(String type) {
    switch (type) {
      case 'MAINTENANCE':   return Icons.build;
      case 'HOUSEKEEPING':  return Icons.cleaning_services;
      case 'RESERVATION':   return Icons.hotel;
      default:              return Icons.info_outline;
    }
  }

  String _capitalize(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1).toLowerCase().replaceAll('_', ' ');
  }
}

// ─── Sub-widgets ────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final String message;
  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(message, style: const TextStyle(color: Color(0xFF475569), fontSize: 13)),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
    );
  }
}

class _InfoItem {
  final IconData icon;
  final String label;
  final String value;
  const _InfoItem(this.icon, this.label, this.value);
}

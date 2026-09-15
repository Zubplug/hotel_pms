import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:intl/intl.dart';

import '../providers/rooms_provider.dart';
import '../models/room_data.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _bg            = Color(0xFF090D14);
const _surface       = Color(0xFF111722);
const _surfaceRaised = Color(0xFF161E2C);
const _border        = Color(0xFF263346);

const _gold          = Color(0xFFE2C873);
const _textPrimary   = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFF94A3B8);
const _textMuted     = Color(0xFF475569);

const _green         = Color(0xFF10B981);
const _blue          = Color(0xFF3B82F6);
const _orange        = Color(0xFFF59E0B);
const _red           = Color(0xFFEF4444);
const _violet        = Color(0xFF8B5CF6);

// ─── Room Details Screen ──────────────────────────────────────────────────────
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
        _HeroHeader(
          data: data,
          statusMeta: statusMeta,
          displayNumber: displayNumber,
          onBack: () => Navigator.of(context).pop(),
        ),

        // ── Tab Bar ───────────────────────────────────────────
        Container(
          color: _bg,
          child: Stack(
            children: [
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(height: 1, color: _border),
              ),
              TabBar(
                controller: _tabCtrl,
                indicatorWeight: 3,
                indicatorColor: _gold,
                indicatorSize: TabBarIndicatorSize.label,
                labelColor: _gold,
                unselectedLabelColor: _textSecondary,
                labelStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
                unselectedLabelStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                ),
                overlayColor: WidgetStateProperty.all(Colors.transparent),
                dividerColor: Colors.transparent,
                tabs: const [
                  Tab(text: 'OVERVIEW'),
                  Tab(text: 'ACTIVITY'),
                ],
              ),
            ],
          ),
        ),

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

  Widget _buildLoading() => const Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 36,
          height: 36,
          child: CircularProgressIndicator(
            color: _gold,
            strokeWidth: 2,
            backgroundColor: Color(0xFF1C2D42),
          ),
        ),
      ],
    ),
  );

  Widget _buildError(Object e) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, color: _red, size: 38),
          const SizedBox(height: 16),
          const Text(
            'Failed to load room',
            style: TextStyle(color: _textPrimary, fontSize: 17, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(e.toString(), style: const TextStyle(color: _textSecondary, fontSize: 12), textAlign: TextAlign.center),
          const SizedBox(height: 24),
          TextButton(
            onPressed: () => ref.refresh(roomDetailsProvider(widget.roomId)),
            child: const Text('Try Again', style: TextStyle(color: _gold, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    ),
  );

  _StatusMeta _statusMeta(String status) => switch (status) {
    'OCCUPIED'       => _StatusMeta(_blue,   Icons.person_rounded,           'Occupied'),
    'READY'          => _StatusMeta(_green,  Icons.check_circle_rounded,     'Vacant · Ready'),
    'DIRTY'          => _StatusMeta(_orange, Icons.cleaning_services_rounded,'Vacant · Dirty'),
    'OUT_OF_ORDER'   => _StatusMeta(_red,    Icons.block_rounded,            'Out of Order'),
    'OUT_OF_SERVICE' => _StatusMeta(_violet, Icons.engineering_rounded,      'Out of Service'),
    _                => _StatusMeta(_textSecondary, Icons.help_outline_rounded, status.replaceAll('_', ' ')),
  };

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
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(20, topPad + 10, 20, 24),
      decoration: BoxDecoration(
        color: _bg,
        // Radial glowing effect behind the room number
        gradient: RadialGradient(
          center: Alignment.topRight,
          radius: 1.2,
          colors: [
            statusMeta.color.withValues(alpha: 0.15),
            _bg,
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Nav Row ─────────────────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  onBack();
                },
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: _surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: _border),
                  ),
                  child: const Icon(Icons.arrow_back_rounded, color: _textPrimary, size: 18),
                ),
              ),
              if (data.managementAttention != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _red.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _red.withValues(alpha: 0.4)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber_rounded, color: _red, size: 14),
                      SizedBox(width: 6),
                      Text('ALERT', style: TextStyle(color: _red, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // ── Room number block ────────────────────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left: location + type
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (locationText != null) ...[
                      Text(
                        locationText.toUpperCase(),
                        style: const TextStyle(
                          color: _textSecondary,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                    ],
                    Text(
                      data.room.roomType.name,
                      style: const TextStyle(
                        color: _textPrimary,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),

              // Right: big room number
              Text(
                displayNumber,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 64,
                  fontWeight: FontWeight.w800,
                  height: 1,
                  letterSpacing: -2.5,
                  shadows: [
                    Shadow(color: statusMeta.color.withValues(alpha: 0.4), blurRadius: 24),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // ── Status row ───────────────────────────────────────────────────
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _StatusPill(
                icon: statusMeta.icon,
                label: statusMeta.label,
                color: statusMeta.color,
                solid: true,
              ),
              _SellabilityBadge(sellability: data.sellability),
            ],
          ),

          // ── Management attention banner ───────────────────────────────────
          if (data.managementAttention != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _red.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _red.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded, color: _red, size: 16),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      data.managementAttention!.message,
                      style: const TextStyle(color: _red, fontSize: 13, fontWeight: FontWeight.w600, height: 1.4),
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

class _StatusPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool solid;

  const _StatusPill({required this.icon, required this.label, required this.color, this.solid = false});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(
      color: solid ? color.withValues(alpha: 0.15) : _surface,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: solid ? color.withValues(alpha: 0.4) : _border),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 12),
        const SizedBox(width: 6),
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: solid ? color : _textPrimary,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
      ],
    ),
  );
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
    return _StatusPill(icon: icon, label: label, color: color, solid: false);
  }
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
class _OverviewTab extends StatelessWidget {
  final RoomDetailsData data;
  const _OverviewTab({required this.data});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 80),
      physics: const BouncingScrollPhysics(),
      children: [
        _CurrentGuestCard(guest: data.currentGuest),
        const SizedBox(height: 16),
        _NextArrivalCard(arrival: data.nextArrival),
        const SizedBox(height: 16),
        _HousekeepingCard(hk: data.housekeeping),
        if (data.maintenance != null) ...[
          const SizedBox(height: 16),
          _MaintenanceCard(maintenance: data.maintenance!),
        ],
      ],
    );
  }
}

// ─── History Tab ──────────────────────────────────────────────────────────────
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
    const previewCount = 4;
    final hasMore = data.timeline.length > previewCount;
    final displayed = timelineExpanded ? data.timeline : data.timeline.take(previewCount).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 80),
      physics: const BouncingScrollPhysics(),
      children: [
        Row(
          children: [
            const Text(
              'Recent Activity',
              style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: _surfaceRaised, borderRadius: BorderRadius.circular(12)),
              child: Text('${data.timeline.length} events', style: const TextStyle(color: _textSecondary, fontSize: 11)),
            ),
          ],
        ),
        const SizedBox(height: 24),
        if (displayed.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: Text('No activity recorded', style: TextStyle(color: _textMuted))),
          )
        else
          ...displayed.asMap().entries.map(
            (e) => _TimelineEntry(event: e.value, isLast: e.key == displayed.length - 1),
          ),
        if (hasMore) ...[
          const SizedBox(height: 16),
          Center(
            child: TextButton.icon(
              onPressed: onToggleTimeline,
              icon: Icon(timelineExpanded ? Icons.expand_less : Icons.expand_more, size: 16, color: _blue),
              label: Text(timelineExpanded ? 'Show Less' : 'View All', style: const TextStyle(color: _blue)),
            ),
          ),
        ],
      ],
    );
  }
}

// ─── Current Guest Card ───────────────────────────────────────────────────────
class _CurrentGuestCard extends StatelessWidget {
  final CurrentGuestInfo? guest;
  const _CurrentGuestCard({required this.guest});

  @override
  Widget build(BuildContext context) {
    if (guest == null) {
      return _PremiumCard(
        icon: Icons.person_outline_rounded,
        title: 'CURRENT GUEST',
        child: const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text('Room is unoccupied', style: TextStyle(color: _textMuted, fontSize: 14)),
        ),
      );
    }

    final fmt = DateFormat('MMM d');
    final nights = guest!.checkOut.difference(guest!.checkIn).inDays;
    final now = DateTime.now();
    final daysLeft = guest!.checkOut.difference(now).inDays;
    final isOverdue = daysLeft < 0;
    final isDepartingToday = daysLeft == 0;

    return _PremiumCard(
      icon: Icons.person_rounded,
      iconColor: _blue,
      title: 'CURRENT GUEST',
      trailing: guest!.vipLevel != null
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: _gold.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
              child: Text(guest!.vipLevel!, style: const TextStyle(color: _gold, fontSize: 9, fontWeight: FontWeight.w800)),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Text(
            guest!.name ?? '🔒 Restricted',
            style: const TextStyle(color: _textPrimary, fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.5),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _StatBlock(label: 'CHECK-IN', value: fmt.format(guest!.checkIn), icon: Icons.login_rounded),
              _StatBlock(label: 'CHECK-OUT', value: fmt.format(guest!.checkOut), icon: Icons.logout_rounded, isAlert: isOverdue),
              _StatBlock(label: 'NIGHTS', value: '$nights', icon: Icons.nights_stay_rounded),
              _StatBlock(label: 'REMAINING', value: isOverdue ? 'OVR' : isDepartingToday ? 'TODAY' : '${daysLeft}d', icon: Icons.timer_outlined, highlightColor: isDepartingToday ? _orange : null),
            ],
          ),
          if (guest!.folioBalance != null) ...[
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _bg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: guest!.folioBalance! > 0 ? _orange.withValues(alpha: 0.3) : _border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long_rounded, size: 16, color: _textSecondary),
                  const SizedBox(width: 12),
                  const Text('Folio Balance', style: TextStyle(color: _textSecondary, fontSize: 14)),
                  const Spacer(),
                  Text(
                    '₦${_fmtBalance(guest!.folioBalance!)}',
                    style: TextStyle(
                      color: guest!.folioBalance! > 0 ? _orange : _green,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
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

  static String _fmtBalance(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000)    return '${(v / 1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }
}

class _StatBlock extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool isAlert;
  final Color? highlightColor;

  const _StatBlock({required this.label, required this.value, required this.icon, this.isAlert = false, this.highlightColor});

  @override
  Widget build(BuildContext context) {
    final color = isAlert ? _red : highlightColor ?? _textPrimary;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: _textSecondary),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(color: _textSecondary, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w700),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ─── Next Arrival Card ────────────────────────────────────────────────────────
class _NextArrivalCard extends StatelessWidget {
  final NextArrivalInfo? arrival;
  const _NextArrivalCard({required this.arrival});

  @override
  Widget build(BuildContext context) {
    if (arrival == null) {
      return _PremiumCard(
        icon: Icons.flight_land_rounded,
        title: 'NEXT ARRIVAL',
        child: const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text('No upcoming arrivals', style: TextStyle(color: _textMuted, fontSize: 14)),
        ),
      );
    }

    final dateFmt = DateFormat('EEE, MMM d');
    final now = DateTime.now();
    final isToday = arrival!.arrivalDate.year == now.year &&
        arrival!.arrivalDate.month == now.month &&
        arrival!.arrivalDate.day == now.day;

    return _PremiumCard(
      icon: Icons.flight_land_rounded,
      iconColor: _green,
      title: 'NEXT ARRIVAL',
      trailing: isToday
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: _orange.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
              child: const Text('TODAY', style: TextStyle(color: _orange, fontSize: 9, fontWeight: FontWeight.w800)),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Text(
            arrival!.guestName ?? '🔒 Restricted',
            style: const TextStyle(color: _textPrimary, fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.5),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _InfoRow(icon: Icons.calendar_today_outlined, label: isToday ? 'Today' : dateFmt.format(arrival!.arrivalDate)),
              if (arrival!.arrivalTime != null)
                _InfoRow(icon: Icons.schedule_rounded, label: arrival!.arrivalTime!),
              _InfoRow(icon: Icons.nights_stay_rounded, label: '${arrival!.nights} nights'),
              _InfoRow(icon: Icons.info_outline_rounded, label: _capitalize(arrival!.status)),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Housekeeping Card ────────────────────────────────────────────────────────
class _HousekeepingCard extends StatelessWidget {
  final HousekeepingInfo hk;
  const _HousekeepingCard({required this.hk});

  @override
  Widget build(BuildContext context) {
    final isClean = hk.status == 'CLEAN' || hk.status == 'INSPECTED';
    final color = isClean ? _green : _orange;

    return _PremiumCard(
      icon: Icons.cleaning_services_rounded,
      iconColor: color,
      title: 'HOUSEKEEPING',
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
        child: Text(hk.status, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w800)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          if (hk.lastUpdatedAt != null)
            _InfoRow(
              icon: Icons.update_rounded,
              label: '${hk.status == 'INSPECTED' ? 'Inspected' : 'Updated'}: ${timeago.format(hk.lastUpdatedAt!)}',
            ),
          if (hk.assignedTo != null) ...[
            const SizedBox(height: 8),
            _InfoRow(icon: Icons.badge_rounded, label: 'Assigned to ${hk.assignedTo!}'),
          ],
          if (hk.lastUpdatedAt == null && hk.assignedTo == null)
            const Text('No recent activity', style: TextStyle(color: _textMuted, fontSize: 14)),
        ],
      ),
    );
  }
}

// ─── Maintenance Card ─────────────────────────────────────────────────────────
class _MaintenanceCard extends StatelessWidget {
  final MaintenanceInfo maintenance;
  const _MaintenanceCard({required this.maintenance});

  @override
  Widget build(BuildContext context) {
    return _PremiumCard(
      icon: Icons.build_rounded,
      iconColor: _red,
      title: 'MAINTENANCE',
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: _red.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
        child: Text(maintenance.status.replaceAll('_', ' '), style: const TextStyle(color: _red, fontSize: 9, fontWeight: FontWeight.w800)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          Text(
            maintenance.reason,
            style: const TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.w500, height: 1.4),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              if (maintenance.priority.isNotEmpty)
                _InfoRow(icon: Icons.flag_rounded, label: 'Priority: ${maintenance.priority}', color: _red),
              if (maintenance.reportedAt != null)
                _InfoRow(icon: Icons.schedule_rounded, label: 'Reported ${timeago.format(maintenance.reportedAt!)}'),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Shared Primitives ────────────────────────────────────────────────────────
class _PremiumCard extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final String title;
  final Widget? trailing;
  final Widget child;

  const _PremiumCard({
    required this.icon,
    this.iconColor,
    required this.title,
    this.trailing,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: iconColor ?? _textSecondary),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(color: _textSecondary, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2),
              ),
              const Spacer(),
              ?trailing,
            ],
          ),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const _InfoRow({required this.icon, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color ?? _textSecondary),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(color: color ?? _textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
      ],
    );
  }
}

// ─── Timeline Entry ───────────────────────────────────────────────────────────
class _TimelineEntry extends StatelessWidget {
  final TimelineEvent event;
  final bool isLast;
  const _TimelineEntry({required this.event, required this.isLast});

  Color _color() => switch (event.type) {
    'MAINTENANCE'  => _red,
    'HOUSEKEEPING' => _orange,
    'RESERVATION'  => _blue,
    _              => _textSecondary,
  };

  IconData _icon() => switch (event.type) {
    'MAINTENANCE'  => Icons.build_rounded,
    'HOUSEKEEPING' => Icons.cleaning_services_rounded,
    'RESERVATION'  => Icons.hotel_rounded,
    _              => Icons.info_outline_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final color = _color();
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _surfaceRaised,
                  shape: BoxShape.circle,
                  border: Border.all(color: _border),
                ),
                child: Icon(_icon(), color: color, size: 16),
              ),
              if (!isLast)
                Expanded(child: Container(width: 2, color: _border, margin: const EdgeInsets.symmetric(vertical: 8))),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          event.title,
                          style: const TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.w600),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        DateFormat('HH:mm').format(event.timestamp),
                        style: const TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  if (event.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      event.subtitle,
                      style: const TextStyle(color: _textSecondary, fontSize: 13, height: 1.4),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    DateFormat('MMM d, yyyy').format(event.timestamp),
                    style: const TextStyle(color: _textMuted, fontSize: 11, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusMeta {
  final Color color;
  final IconData icon;
  final String label;
  const _StatusMeta(this.color, this.icon, this.label);
}

String _capitalize(String s) {
  if (s.isEmpty) return s;
  return s[0].toUpperCase() + s.substring(1).toLowerCase().replaceAll('_', ' ');
}

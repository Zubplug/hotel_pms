import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/fnb_provider.dart';
import '../models/fnb_dashboard_data.dart';
import '../widgets/fnb_hero_card.dart';
import '../widgets/fnb_outlet_cards.dart';
import '../widgets/fnb_top_items.dart';
import '../widgets/fnb_operations_strip.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _bgDeep = Color(0xFF070D1A);
const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _sapphire = Color(0xFF3B82F6);
const _violet = Color(0xFF8B5CF6);
const _gold = Color(0xFFD4AF37);
const _rose = Color(0xFFF43F5E);
const _amber = Color(0xFFF59E0B);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF64748B);

class FnbScreen extends ConsumerWidget {
  const FnbScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(fnbDashboardProvider);

    return Scaffold(
      backgroundColor: _bgDeep,
      body: state.when(
        loading: () => const _LoadingView(),
        error: (err, _) => _ErrorView(
          error: err,
          onRetry: () => ref.invalidate(fnbDashboardProvider),
        ),
        data: (data) => _FnbBody(
          data: data,
          onRefresh: () async => ref.invalidate(fnbDashboardProvider),
        ),
      ),
    );
  }
}

// ─── Body ─────────────────────────────────────────────────────────────────────

class _FnbBody extends StatelessWidget {
  final FnbDashboardData data;
  final Future<void> Function() onRefresh;

  const _FnbBody({required this.data, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final timeStr = DateFormat('HH:mm').format(now);

    return RefreshIndicator(
      color: _emerald,
      backgroundColor: _surface,
      onRefresh: onRefresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // ── App Bar ────────────────────────────────────────────────────────
          SliverAppBar(
            pinned: true,
            backgroundColor: _bgDeep,
            elevation: 0,
            surfaceTintColor: Colors.transparent,
            flexibleSpace: Container(
              decoration: const BoxDecoration(
                color: _bgDeep,
                border: Border(
                  bottom: BorderSide(color: Color(0xFF1E3048), width: 0.5),
                ),
              ),
            ),
            title: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: _emerald.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _emerald.withValues(alpha: 0.25)),
                  ),
                  child: const Icon(
                    Icons.dashboard_customize_rounded,
                    color: _emerald,
                    size: 16,
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Hospitality Ops',
                      style: TextStyle(
                        color: _textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      'Audited control · $timeStr',
                      style: const TextStyle(color: _textMuted, fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
            actions: [
              Container(
                margin: const EdgeInsets.only(right: 16),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: _surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: _emerald,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    const Text(
                      'LIVE',
                      style: TextStyle(
                        color: _emerald,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // ── Content ────────────────────────────────────────────────────────
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _ManagementWorkspace(data: data),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _ManagementWorkspace extends StatefulWidget {
  final FnbDashboardData data;

  const _ManagementWorkspace({required this.data});

  @override
  State<_ManagementWorkspace> createState() => _ManagementWorkspaceState();
}

class _ManagementWorkspaceState extends State<_ManagementWorkspace> {
  int _view = 0;

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CommandHero(data: data),
        const SizedBox(height: 18),
        _ViewSwitcher(
          selected: _view,
          onChanged: (value) => setState(() => _view = value),
        ),
        const SizedBox(height: 20),
        if (_view == 0) _FnbManagementView(data: data),
        if (_view == 1) _EventsManagementView(data: data),
        if (_view == 2) _HallsManagementView(data: data),
        const SizedBox(height: 24),
        Text(
          'Management view · business date ${data.businessDate}. Revenue is sourced from the accounting engine; event and hall figures reflect the next 30-day operating window.',
          style: const TextStyle(color: _textMuted, fontSize: 9, height: 1.6),
        ),
      ],
    );
  }
}

class _CommandHero extends StatelessWidget {
  final FnbDashboardData data;
  const _CommandHero({required this.data});

  @override
  Widget build(BuildContext context) {
    final event = data.eventOverview;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF142A3D), Color(0xFF10211F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _sapphire.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: _sapphire.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.dashboard_customize_rounded,
                  color: _sapphire,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'OPERATIONS CONTROL CENTRE',
                      style: TextStyle(
                        color: _textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Food, events and venue readiness',
                      style: TextStyle(color: _textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              _StatusDot(
                label: event.todayEvents > 0 ? 'ACTIVE DAY' : 'NO EVENTS',
                color: event.todayEvents > 0 ? _amber : _emerald,
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _HeroMetric(
                  label: 'AUDITED F&B',
                  value: _money(data.summary.totalFnbRevenue),
                  color: _emerald,
                ),
              ),
              Expanded(
                child: _HeroMetric(
                  label: 'EVENTS / 30D',
                  value: '${event.totalEvents}',
                  color: _gold,
                ),
              ),
              Expanded(
                child: _HeroMetric(
                  label: 'OPEN HALLS',
                  value:
                      '${data.hallOverview.where((h) => h.bookings == 0).length}',
                  color: _sapphire,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ViewSwitcher extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onChanged;
  const _ViewSwitcher({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    const labels = ['F&B PERFORMANCE', 'EVENT PIPELINE', 'HALLS & VENUES'];
    const icons = [
      Icons.restaurant_rounded,
      Icons.event_available_rounded,
      Icons.meeting_room_rounded,
    ];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Row(
        children: List.generate(labels.length, (index) {
          final active = selected == index;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                  vertical: 11,
                  horizontal: 4,
                ),
                decoration: BoxDecoration(
                  color: active
                      ? _sapphire.withValues(alpha: 0.18)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    Icon(
                      icons[index],
                      color: active ? _sapphire : _textMuted,
                      size: 17,
                    ),
                    const SizedBox(height: 5),
                    Text(
                      labels[index],
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: active ? _textPrimary : _textMuted,
                        fontSize: 8,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _FnbManagementView extends StatelessWidget {
  final FnbDashboardData data;
  const _FnbManagementView({required this.data});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      FnbHeroCard(summary: data.summary, businessDate: data.businessDate),
      if (data.outletBreakdown.isNotEmpty) ...[
        const SizedBox(height: 24),
        _SectionHeader(
          icon: Icons.storefront_rounded,
          title: 'OUTLET COMMAND',
          subtitle: 'Revenue, covers and average check by outlet',
        ),
        const SizedBox(height: 12),
        FnbOutletCards(outlets: data.outletBreakdown),
      ],
      const SizedBox(height: 24),
      _SectionHeader(
        icon: Icons.point_of_sale_rounded,
        title: 'SERVICE READINESS',
        subtitle: 'Terminals, sessions and exceptions requiring attention',
      ),
      const SizedBox(height: 12),
      FnbOperationsStrip(ops: data.posOperations, summary: data.summary),
      if (data.topSellingItems.isNotEmpty) ...[
        const SizedBox(height: 24),
        _SectionHeader(
          icon: Icons.emoji_events_rounded,
          title: 'DEMAND SIGNALS',
          subtitle: 'Top products and current trading pattern',
        ),
        const SizedBox(height: 12),
        FnbTopItems(items: data.topSellingItems),
      ],
    ],
  );
}

class _EventsManagementView extends StatelessWidget {
  final FnbDashboardData data;
  const _EventsManagementView({required this.data});

  @override
  Widget build(BuildContext context) {
    final e = data.eventOverview;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          icon: Icons.account_balance_rounded,
          title: 'AUDITED REVENUE',
          subtitle: 'Closed financial performance for the reporting date',
        ),
        const SizedBox(height: 12),
        AuditedRevenueCard(
          title: 'AUDITED EVENT REVENUE',
          subtitle: 'Hall, equipment and event food posted at night audit',
          amount: data.auditedVenueRevenue.eventRevenue,
          icon: Icons.event_available_rounded,
          color: _gold,
        ),
        const SizedBox(height: 24),
        _MetricGrid(
          items: [
            _MetricTile(
              'TODAY',
              '${e.todayEvents}',
              'events scheduled',
              Icons.today_rounded,
              _amber,
            ),
            _MetricTile(
              'CONFIRMED',
              '${e.confirmedEvents}',
              'in pipeline',
              Icons.verified_rounded,
              _emerald,
            ),
            _MetricTile(
              'IN SERVICE',
              '${e.inServiceEvents}',
              'currently running',
              Icons.play_circle_rounded,
              _sapphire,
            ),
            _MetricTile(
              'TENTATIVE',
              '${e.tentativeEvents}',
              'awaiting confirmation',
              Icons.pending_actions_rounded,
              _rose,
            ),
          ],
        ),
        const SizedBox(height: 24),
        _OperationsCalendar(
          events: e.events,
          halls: data.hallOverview,
          title: 'EVENT CALENDAR',
          subtitle: 'Daily schedule, venue allocation and event status',
          accent: _gold,
        ),
        const SizedBox(height: 24),
        _SectionHeader(
          icon: Icons.timeline_rounded,
          title: 'EVENT PIPELINE',
          subtitle:
              '${e.totalEvents} active events in the next ${e.windowDays} days',
        ),
        const SizedBox(height: 12),
        _PipelineSummary(overview: e),
      ],
    );
  }
}

class _PipelineSummary extends StatelessWidget {
  final FnbEventOverview overview;
  const _PipelineSummary({required this.overview});

  @override
  Widget build(BuildContext context) {
    final collectedRatio = overview.pipelineValue > 0
        ? (overview.collectedValue / overview.pipelineValue).clamp(0.0, 1.0)
        : 0.0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.insights_rounded, color: _gold, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'COMMERCIAL OUTLOOK',
                  style: TextStyle(
                    color: _textPrimary,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .8,
                  ),
                ),
              ),
              Text(
                '${overview.totalEvents} events',
                style: const TextStyle(color: _textMuted, fontSize: 10),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _PipelineValue(
                label: 'PIPELINE',
                value: _money(overview.pipelineValue),
                color: _gold,
              ),
              _PipelineValue(
                label: 'COLLECTED',
                value: _money(overview.collectedValue),
                color: _emerald,
              ),
              _PipelineValue(
                label: 'OUTSTANDING',
                value: _money(overview.outstandingValue),
                color: _rose,
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: collectedRatio.toDouble(),
              minHeight: 5,
              backgroundColor: _border,
              valueColor: const AlwaysStoppedAnimation(_emerald),
            ),
          ),
          const SizedBox(height: 9),
          const Text(
            'Select a date above to inspect the event schedule and hall availability.',
            style: TextStyle(color: _textMuted, fontSize: 10, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _PipelineValue extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _PipelineValue({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 8,
            fontWeight: FontWeight.w800,
            letterSpacing: .6,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: _textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _HallsManagementView extends StatelessWidget {
  final FnbDashboardData data;
  const _HallsManagementView({required this.data});

  @override
  Widget build(BuildContext context) {
    final halls = data.hallOverview;
    final booked = halls.where((h) => h.bookings > 0).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          icon: Icons.account_balance_rounded,
          title: 'AUDITED REVENUE',
          subtitle: 'Closed financial performance for the reporting date',
        ),
        const SizedBox(height: 12),
        AuditedRevenueCard(
          title: 'AUDITED HALL REVENUE',
          subtitle: 'Venue hire revenue posted at night audit',
          amount: data.auditedVenueRevenue.hallRevenue,
          icon: Icons.meeting_room_rounded,
          color: _sapphire,
        ),
        const SizedBox(height: 24),
        _MetricGrid(
          items: [
            _MetricTile(
              'VENUES',
              '${halls.length}',
              'active halls',
              Icons.meeting_room_rounded,
              _sapphire,
            ),
            _MetricTile(
              'BOOKED',
              '$booked',
              'with upcoming use',
              Icons.event_seat_rounded,
              _amber,
            ),
            _MetricTile(
              'OPEN',
              '${halls.length - booked}',
              'available in window',
              Icons.lock_open_rounded,
              _emerald,
            ),
            _MetricTile(
              'CAPACITY',
              '${halls.fold<int>(0, (sum, hall) => sum + hall.capacity)}',
              'total seats',
              Icons.groups_rounded,
              _violet,
            ),
          ],
        ),
        const SizedBox(height: 24),
        _OperationsCalendar(
          events: data.eventOverview.events,
          halls: halls,
          title: 'HALL OCCUPANCY CALENDAR',
          subtitle: 'Review hall commitments by day before scheduling',
          accent: _sapphire,
        ),
        const SizedBox(height: 24),
        _SectionHeader(
          icon: Icons.grid_view_rounded,
          title: 'VENUE BOARD',
          subtitle: 'Capacity, utilization and next commitment',
        ),
        const SizedBox(height: 12),
        if (halls.isEmpty)
          const _EmptyPanel(
            icon: Icons.meeting_room_outlined,
            text: 'No active halls configured for this property',
          )
        else
          ...halls.map((hall) => _HallRow(hall: hall)),
      ],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  final List<_MetricTile> items;
  const _MetricGrid({required this.items});

  @override
  Widget build(BuildContext context) => GridView.count(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisCount: 2,
    childAspectRatio: 1.75,
    mainAxisSpacing: 10,
    crossAxisSpacing: 10,
    children: items
        .map(
          (item) => Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: item.color.withValues(alpha: 0.22)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(item.icon, color: item.color, size: 18),
                const Spacer(),
                Text(
                  item.value,
                  style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  item.label,
                  style: TextStyle(
                    color: item.color,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
                Text(
                  item.subtitle,
                  style: const TextStyle(color: _textMuted, fontSize: 9),
                ),
              ],
            ),
          ),
        )
        .toList(),
  );
}

class _MetricTile {
  final String label;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  const _MetricTile(
    this.label,
    this.value,
    this.subtitle,
    this.icon,
    this.color,
  );
}

class _OperationsCalendar extends StatefulWidget {
  final List<FnbEvent> events;
  final List<FnbHall> halls;
  final String title;
  final String subtitle;
  final Color accent;

  const _OperationsCalendar({
    required this.events,
    required this.halls,
    required this.title,
    required this.subtitle,
    required this.accent,
  });

  @override
  State<_OperationsCalendar> createState() => _OperationsCalendarState();
}

class _OperationsCalendarState extends State<_OperationsCalendar> {
  late DateTime _selectedDay;

  DateTime _dateOnly(DateTime value) =>
      DateTime(value.year, value.month, value.day);

  @override
  void initState() {
    super.initState();
    final today = _dateOnly(DateTime.now());
    final firstEvent = widget.events.isEmpty
        ? null
        : _dateOnly(widget.events.first.startDate);
    _selectedDay = firstEvent != null && firstEvent.isAfter(today)
        ? firstEvent
        : today;
  }

  bool _isOnDay(FnbEvent event, DateTime day) {
    if (event.bookings.isNotEmpty) {
      return event.bookings.any((booking) {
        final start = _dateOnly(booking.startTime);
        final end = _dateOnly(booking.endTime);
        return !start.isAfter(day) && !end.isBefore(day);
      });
    }
    final start = _dateOnly(event.startDate);
    final end = _dateOnly(event.endDate);
    return !start.isAfter(day) && !end.isBefore(day);
  }

  List<FnbEvent> _eventsFor(DateTime day) =>
      widget.events.where((event) => _isOnDay(event, day)).toList();

  List<String> _hallsForEventOnDay(FnbEvent event, DateTime day) {
    final bookings = event.bookings
        .where((booking) {
          final start = _dateOnly(booking.startTime);
          final end = _dateOnly(booking.endTime);
          return !start.isAfter(day) && !end.isBefore(day);
        })
        .map((booking) => booking.hall)
        .toSet()
        .toList();
    return bookings.isEmpty ? event.halls : bookings;
  }

  void _shift(int days) =>
      setState(() => _selectedDay = _selectedDay.add(Duration(days: days)));

  @override
  Widget build(BuildContext context) {
    final selectedEvents = _eventsFor(_selectedDay);
    final bookedHallNames = selectedEvents
        .expand((event) => _hallsForEventOnDay(event, _selectedDay))
        .toSet();
    final availableHalls = widget.halls
        .where((hall) => !bookedHallNames.contains(hall.name))
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          icon: Icons.calendar_month_rounded,
          title: widget.title,
          subtitle: widget.subtitle,
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: widget.accent.withValues(alpha: .22)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () => _shift(-1),
                    icon: const Icon(
                      Icons.chevron_left_rounded,
                      color: _textSecondary,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      DateFormat('EEEE, dd MMM yyyy').format(_selectedDay),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: _textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => _shift(1),
                    icon: const Icon(
                      Icons.chevron_right_rounded,
                      color: _textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _selectedDay,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2035),
                    builder: (context, child) => Theme(
                      data: Theme.of(context).copyWith(
                        colorScheme: ColorScheme.dark(
                          primary: widget.accent,
                          surface: _surface,
                        ),
                      ),
                      child: child!,
                    ),
                  );
                  if (picked != null) {
                    setState(() => _selectedDay = _dateOnly(picked));
                  }
                },
                icon: Icon(Icons.event_rounded, size: 15, color: widget.accent),
                label: Text(
                  'SELECT CUSTOM DATE',
                  style: TextStyle(
                    color: widget.accent,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .7,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: widget.accent.withValues(alpha: .35)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(9),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              if (selectedEvents.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(14),
                  child: Text(
                    'No events scheduled for this day',
                    style: TextStyle(color: _textMuted, fontSize: 11),
                  ),
                )
              else
                ...selectedEvents.map(
                  (event) => _CalendarEventTile(
                    event: event,
                    halls: _hallsForEventOnDay(event, _selectedDay),
                    selectedDay: _selectedDay,
                    accent: widget.accent,
                  ),
                ),
              const SizedBox(height: 8),
              _SectionHeader(
                icon: Icons.meeting_room_outlined,
                title: 'AVAILABLE HALLS',
                subtitle: 'Open for the selected date',
              ),
              const SizedBox(height: 8),
              if (availableHalls.isEmpty)
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'All configured halls are committed on this date',
                    style: TextStyle(color: _amber, fontSize: 10),
                  ),
                )
              else
                Align(
                  alignment: Alignment.centerLeft,
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: availableHalls
                        .map(
                          (hall) => _AvailabilityChip(
                            label: hall.name,
                            color: _emerald,
                          ),
                        )
                        .toList(),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AvailabilityChip extends StatelessWidget {
  final String label;
  final Color color;
  const _AvailabilityChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .10),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color.withValues(alpha: .25)),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w700),
    ),
  );
}

/*
class _CalendarModeButton extends StatelessWidget {
  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;
  const _CalendarModeButton({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: BoxDecoration(
        color: selected ? color.withValues(alpha: .16) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: selected ? color : _textMuted,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 1,
        ),
      ),
    ),
  );
}

class _CalendarDayRow extends StatelessWidget {
  final DateTime day;
  final List<FnbEvent> events;
  final Color accent;
  const _CalendarDayRow({
    required this.day,
    required this.events,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 48,
          child: Text(
            DateFormat('EEE\ndd').format(day),
            style: const TextStyle(
              color: _textMuted,
              fontSize: 10,
              height: 1.25,
            ),
          ),
        ),
        Expanded(
          child: events.isEmpty
              ? const Text(
                  'No bookings',
                  style: TextStyle(color: _textMuted, fontSize: 10),
                )
              : Wrap(
                  spacing: 5,
                  runSpacing: 4,
                  children: events
                      .take(3)
                      .map(
                        (event) =>
                            _CalendarChip(label: event.name, color: accent),
                      )
                      .toList(),
                ),
        ),
      ],
    ),
  );
}

*/
class _CalendarEventTile extends StatelessWidget {
  final FnbEvent event;
  final List<String> halls;
  final DateTime selectedDay;
  final Color accent;
  const _CalendarEventTile({
    required this.event,
    required this.halls,
    required this.selectedDay,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 7),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: accent.withValues(alpha: .07),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          event.name,
          style: const TextStyle(
            color: _textPrimary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${DateFormat('dd MMM').format(selectedDay)} · ${halls.take(4).join(' · ')}',
          style: TextStyle(
            color: accent,
            fontSize: 9,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

/*
class _CalendarChip extends StatelessWidget {
  final String label;
  final Color color;
  const _CalendarChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(maxWidth: 190),
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w700),
    ),
  );
}

}
*/
/*
class _EventRow extends StatelessWidget {
  final FnbEvent event;
  const _EventRow({required this.event});

  @override
  Widget build(BuildContext context) {
    final statusColor = event.status == 'IN_SERVICE'
        ? _sapphire
        : event.status == 'CONFIRMED'
        ? _emerald
        : _amber;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  event.name,
                  style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _StatusDot(
                label: event.status.replaceAll('_', ' '),
                color: statusColor,
              ),
            ],
          ),
          const SizedBox(height: 9),
          Row(
            children: [
              Icon(Icons.calendar_today_rounded, color: _textMuted, size: 12),
              const SizedBox(width: 5),
              Text(
                DateFormat('dd MMM · HH:mm').format(event.startDate),
                style: const TextStyle(color: _textSecondary, fontSize: 10),
              ),
              const SizedBox(width: 14),
              Icon(Icons.groups_rounded, color: _textMuted, size: 13),
              const SizedBox(width: 4),
              Text(
                '${event.actualGuests ?? event.expectedGuests} guests',
                style: const TextStyle(color: _textSecondary, fontSize: 10),
              ),
            ],
          ),
          if (event.halls.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              event.halls.length <= 4
                  ? event.halls.join(' · ')
                  : '${event.halls.take(4).join(' · ')} · +${event.halls.length - 4} more',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: _sapphire,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(
                Icons.account_balance_rounded,
                color: _textMuted,
                size: 12,
              ),
              const SizedBox(width: 5),
              Text(
                'Commercial status: ${event.financialStatus.replaceAll('_', ' ')}',
                style: const TextStyle(color: _textMuted, fontSize: 9),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

}
*/
class _HallRow extends StatelessWidget {
  final FnbHall hall;
  const _HallRow({required this.hall});

  @override
  Widget build(BuildContext context) {
    final color = hall.bookings == 0
        ? _emerald
        : hall.utilization >= 85
        ? _rose
        : _amber;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(Icons.meeting_room_rounded, color: color, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hall.name,
                      style: const TextStyle(
                        color: _textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${hall.code} · capacity ${hall.capacity}',
                      style: const TextStyle(color: _textMuted, fontSize: 10),
                    ),
                  ],
                ),
              ),
              Text(
                hall.bookings == 0
                    ? 'OPEN'
                    : '${hall.bookings} BOOKING${hall.bookings == 1 ? '' : 'S'}',
                style: TextStyle(
                  color: color,
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: hall.utilization / 100,
                    minHeight: 6,
                    backgroundColor: _bgDeep,
                    valueColor: AlwaysStoppedAnimation(color),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '${hall.utilization.toStringAsFixed(0)}%',
                style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (hall.nextEvent != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.arrow_forward_rounded,
                  color: _textMuted,
                  size: 12,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    hall.nextEvent!,
                    style: const TextStyle(color: _textSecondary, fontSize: 10),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusDot({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withValues(alpha: 0.25)),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: color,
        fontSize: 8,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.5,
      ),
    ),
  );
}

class _HeroMetric extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _HeroMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: _textMuted,
          fontSize: 8,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
      const SizedBox(height: 5),
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 15,
          fontWeight: FontWeight.w800,
        ),
      ),
    ],
  );
}

class _EmptyPanel extends StatelessWidget {
  final IconData icon;
  final String text;
  const _EmptyPanel({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: _border),
    ),
    child: Column(
      children: [
        Icon(icon, color: _textMuted, size: 28),
        const SizedBox(height: 10),
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: _textMuted, fontSize: 12),
        ),
      ],
    ),
  );
}

String _money(double value) {
  if (value >= 1000000) return '₦${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '₦${(value / 1000).toStringAsFixed(1)}K';
  return '₦${value.toStringAsFixed(0)}';
}

// ─── Section Header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: _emerald, size: 16),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: _textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(color: _textMuted, fontSize: 10),
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Loading & Error ──────────────────────────────────────────────────────────

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgDeep,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: _emerald.withValues(alpha: 0.1),
                shape: BoxShape.circle,
                border: Border.all(color: _emerald.withValues(alpha: 0.2)),
              ),
              child: const Icon(
                Icons.dashboard_customize_rounded,
                color: _emerald,
                size: 24,
              ),
            ),
            const SizedBox(height: 20),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(color: _emerald, strokeWidth: 2),
            ),
            const SizedBox(height: 16),
            const Text(
              'Loading Hospitality Operations…',
              style: TextStyle(color: _textMuted, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;

  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgDeep,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.restaurant_outlined,
                color: _textMuted,
                size: 48,
              ),
              const SizedBox(height: 16),
              const Text(
                'Could not load Hospitality Operations',
                style: TextStyle(
                  color: _textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                error.toString(),
                style: const TextStyle(color: _textMuted, fontSize: 12),
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 24),
              GestureDetector(
                onTap: onRetry,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: _emerald.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _emerald.withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    'Try Again',
                    style: TextStyle(
                      color: _emerald,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
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

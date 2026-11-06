import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:mobile_management/features/hub/presentation/screens/night_audit_review_screen.dart';
import 'package:mobile_management/features/hub/providers/hub_provider.dart';
import 'package:mobile_management/features/notifications/presentation/providers/notifications_provider.dart';
import 'package:mobile_management/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:mobile_management/features/profile/presentation/providers/profile_provider.dart';
import 'package:mobile_management/features/profile/presentation/screens/profile_screen.dart';

import '../models/auditor_dashboard_data.dart';
import '../providers/auditor_dashboard_provider.dart';
import '../widgets/auditor/audit_exceptions_widget.dart';
import '../widgets/auditor/cash_reconciliation_widget.dart';
import '../widgets/auditor/discrepancy_list_widget.dart';
import '../widgets/auditor/night_audit_status_widget.dart';

// ─── Design Tokens ───────────────────────────────────────────────────────────
const _bg = Color(0xFF060C17);
const _surface = Color(0xFF0C1828);
const _surfaceEl = Color(0xFF111F34);
const _border = Color(0xFF1A2D47);

const _text = Color(0xFFF0F5FF);
const _textSub = Color(0xFF8FA3BF);
const _textDim = Color(0xFF4D6480);

const _gold = Color(0xFFD4A843);
const _goldDark = Color(0xFFB8902A);

const _emerald = Color(0xFF10B981);
const _sky = Color(0xFF38BDF8);
const _violet = Color(0xFF8B5CF6);
const _amber = Color(0xFFF59E0B);
const _rose = Color(0xFFF43F5E);

// ─── Root Widget ─────────────────────────────────────────────────────────────
class AuditorDashboardScreen extends ConsumerWidget {
  const AuditorDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(auditorDashboardDataProvider);
    final profile = ref.watch(profileProvider);
    final unread = ref.watch(unreadCountProvider);
    final selectedPropId = ref.watch(selectedHubPropertyProvider);

    final propertyName = profile.maybeWhen(
      data: (v) {
        final props = v.authorization.properties;
        if (selectedPropId != null) {
          for (final p in props) {
            if (p.id == selectedPropId) return p.name;
          }
        }
        return props.isNotEmpty
            ? props.first.name
            : (dashboard.value?.propertyName ?? 'LodgeCore');
      },
      orElse: () => dashboard.value?.propertyName ?? 'LodgeCore',
    );

    return Scaffold(
      backgroundColor: _bg,
      body: dashboard.when(
        loading: () =>
            _ShimmerLoader(propertyName: propertyName, unread: unread),
        error: (err, _) => _ErrorView(
          error: err,
          onRetry: () => ref.refresh(auditorDashboardDataProvider.future),
        ),
        data: (data) => RefreshIndicator(
          color: _gold,
          backgroundColor: _surfaceEl,
          strokeWidth: 2.5,
          displacement: 70,
          onRefresh: () async =>
              ref.refresh(auditorDashboardDataProvider.future),
          child: _DashBody(
            data: data,
            propertyName: propertyName,
            unread: unread,
            propertyId: selectedPropId ?? ref.read(effectivePropertyIdProvider),
            ref: ref,
          ),
        ),
      ),
    );
  }
}

// ─── Main Scroll Body ────────────────────────────────────────────────────────
class _DashBody extends StatelessWidget {
  final AuditorDashboardData data;
  final String propertyName;
  final String propertyId;
  final int unread;
  final WidgetRef ref;

  const _DashBody({
    required this.data,
    required this.propertyName,
    required this.propertyId,
    required this.unread,
    required this.ref,
  });

  @override
  Widget build(BuildContext context) {
    final blockers =
        data.auditStatus.blockingErrors.length +
        data.auditExceptions.criticalCount;
    final isReady = blockers == 0;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        _AuditAppBar(
          propertyName: propertyName,
          unread: unread,
          businessDate: data.businessDate,
          lastUpdatedAt: data.lastUpdatedAt,
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _AuditHeroCard(
                data: data,
                isReady: isReady,
                blockers: blockers,
                propertyId: propertyId,
                propertyName: propertyName,
              ),
              const SizedBox(height: 14),
              // ── Audit run status & timeline — most urgent info first ──────
              _SectionLabel(
                title: 'AUDIT RUN STATUS',
                subtitle: 'Current night audit run progress & timeline',
                icon: Icons.nightlight_round,
                color: _violet,
              ),
              const SizedBox(height: 10),
              NightAuditStatusWidget(
                status: data.auditStatus,
                businessDate: data.businessDate,
                analytics: data.analytics,
              ),
              const SizedBox(height: 20),
              _SectionLabel(
                title: 'PERFORMANCE ANALYTICS',
                subtitle: 'Last night audit vs prior period',
                icon: Icons.trending_up_rounded,
                color: _emerald,
              ),
              const SizedBox(height: 10),
              _KpiGrid(data: data),
              const SizedBox(height: 20),
              _SectionLabel(
                title: 'OPERATIONS SNAPSHOT',
                subtitle: 'Movement counts for tonight\'s close',
                icon: Icons.insights_rounded,
                color: _sky,
              ),
              const SizedBox(height: 10),
              _OperationsPanel(data: data),
              const SizedBox(height: 20),
              _SectionLabel(
                title: 'CLOSE READINESS',
                subtitle: 'Blockers that must be resolved before posting',
                icon: Icons.fact_check_rounded,
                color: _gold,
              ),
              const SizedBox(height: 10),
              _ReadinessCard(data: data),
              const SizedBox(height: 14),
              _AttentionQueue(data: data),
              const SizedBox(height: 20),
              _SectionLabel(
                title: 'EXCEPTIONS',
                subtitle: 'Flagged items requiring auditor sign-off',
                icon: Icons.error_outline_rounded,
                color: _rose,
              ),
              const SizedBox(height: 10),
              AuditExceptionsWidget(exceptions: data.auditExceptions),
              const SizedBox(height: 14),
              DiscrepancyListWidget(discrepancies: data.criticalDiscrepancies),
              const SizedBox(height: 20),
              _SectionLabel(
                title: 'CASH & SHIFT RECONCILIATION',
                subtitle: 'Open positions that must close before audit',
                icon: Icons.point_of_sale_rounded,
                color: _amber,
              ),
              const SizedBox(height: 10),
              CashReconciliationWidget(reconciliation: data.cashReconciliation),
            ]),
          ),
        ),
      ],
    );
  }
}

// ─── Sliver App Bar ───────────────────────────────────────────────────────────
class _AuditAppBar extends StatelessWidget {
  final String propertyName;
  final int unread;
  final String businessDate;
  final DateTime lastUpdatedAt;

  const _AuditAppBar({
    required this.propertyName,
    required this.unread,
    required this.businessDate,
    required this.lastUpdatedAt,
  });

  @override
  Widget build(BuildContext context) {
    final age = DateTime.now().difference(lastUpdatedAt).inMinutes;
    final fresh = age < 1;

    return SliverAppBar(
      pinned: true,
      floating: false,
      backgroundColor: _bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      expandedHeight: 86,
      collapsedHeight: 64,
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.pin,
        titlePadding: const EdgeInsets.only(left: 20, bottom: 12),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _PulseDot(color: fresh ? _emerald : _amber),
                const SizedBox(width: 6),
                Text(
                  'NIGHT AUDIT · $businessDate',
                  style: const TextStyle(
                    color: _gold,
                    fontSize: 8.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.8,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              propertyName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: _text,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
      actions: [
        _IconBtn(
          tooltip: 'Notifications',
          icon: Icons.notifications_outlined,
          badge: unread,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const NotificationsScreen()),
          ),
        ),
        _IconBtn(
          tooltip: 'Profile',
          icon: Icons.person_outline_rounded,
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
        ),
        const SizedBox(width: 6),
      ],
    );
  }
}

// ─── Animated Pulse Dot ───────────────────────────────────────────────────────
class _PulseDot extends StatefulWidget {
  final Color color;
  const _PulseDot({required this.color});

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _ctrl,
    builder: (_, __) => Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: widget.color,
        boxShadow: [
          BoxShadow(
            color: widget.color.withValues(alpha: _ctrl.value * 0.75),
            blurRadius: 7,
            spreadRadius: 1,
          ),
        ],
      ),
    ),
  );
}

// ─── Icon Button ──────────────────────────────────────────────────────────────
class _IconBtn extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final int badge;

  const _IconBtn({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.badge = 0,
  });

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onTap,
    icon: Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon, color: _textSub, size: 22),
        if (badge > 0)
          Positioned(
            right: -5,
            top: -5,
            child: Container(
              constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
              padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
              decoration: BoxDecoration(
                color: _rose,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _bg, width: 1.5),
              ),
              child: Text(
                badge > 99 ? '99+' : '$badge',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 7.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

// ─── Audit Hero Card ──────────────────────────────────────────────────────────
class _AuditHeroCard extends StatelessWidget {
  final AuditorDashboardData data;
  final bool isReady;
  final int blockers;
  final String propertyId;
  final String propertyName;

  const _AuditHeroCard({
    required this.data,
    required this.isReady,
    required this.blockers,
    required this.propertyId,
    required this.propertyName,
  });

  @override
  Widget build(BuildContext context) {
    final c = isReady ? _emerald : _amber;
    final gradEnd = isReady ? const Color(0xFF0D2820) : const Color(0xFF231A0C);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_surfaceEl, gradEnd],
        ),
        border: Border.all(color: c.withValues(alpha: .3), width: 1),
        boxShadow: [
          BoxShadow(
            color: c.withValues(alpha: .07),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: .4),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            Positioned(
              right: -40,
              top: -40,
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [c.withValues(alpha: .1), Colors.transparent],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: c.withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: c.withValues(alpha: .25)),
                        ),
                        child: Icon(
                          isReady
                              ? Icons.verified_rounded
                              : Icons.gavel_rounded,
                          color: c,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isReady
                                  ? 'Ready to Post'
                                  : '$blockers Item${blockers == 1 ? '' : 's'} Need Attention',
                              style: TextStyle(
                                color: c,
                                fontSize: 17,
                                fontWeight: FontWeight.w900,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isReady
                                  ? 'All controls reconciled. Verify then post the close.'
                                  : 'Resolve exceptions before closing the business date.',
                              style: const TextStyle(
                                color: _textSub,
                                fontSize: 11.5,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _AuditProgressBar(data: data, isReady: isReady),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: _HeroButton(
                      label: isReady
                          ? 'Start Audit Review'
                          : 'Open Audit Checklist',
                      icon: isReady
                          ? Icons.play_arrow_rounded
                          : Icons.checklist_rounded,
                      color: c,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => NightAuditReviewScreen(
                            propertyId: propertyId,
                            propertyName: propertyName,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuditProgressBar extends StatelessWidget {
  final AuditorDashboardData data;
  final bool isReady;

  const _AuditProgressBar({required this.data, required this.isReady});

  @override
  Widget build(BuildContext context) {
    final issues = data.criticalDiscrepancies;
    final controls = data.controls;
    final totalChecks = 8;
    final clearChecks = [
      issues.roomStatusDiscrepancies == 0,
      issues.occupancyDiscrepancies == 0,
      issues.unpostedCharges == 0,
      issues.openFolios == 0,
      issues.reservationsRequiringAttention == 0,
      controls.openPosSessions == 0,
      controls.openFrontdeskSessions == 0,
      controls.financialSyncConflicts == 0,
    ].where((b) => b).length;
    final progress = clearChecks / totalChecks;
    final c = isReady ? _emerald : _amber;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '$clearChecks / $totalChecks checks passed',
              style: const TextStyle(
                color: _textSub,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            Text(
              '${(progress * 100).round()}%',
              style: TextStyle(
                color: c,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            backgroundColor: _border,
            valueColor: AlwaysStoppedAnimation(c),
          ),
        ),
      ],
    );
  }
}

class _HeroButton extends StatefulWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _HeroButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  State<_HeroButton> createState() => _HeroButtonState();
}

class _HeroButtonState extends State<_HeroButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => setState(() => _pressed = true),
    onTapUp: (_) {
      setState(() => _pressed = false);
      widget.onTap();
    },
    onTapCancel: () => setState(() => _pressed = false),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 110),
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: _pressed ? widget.color.withValues(alpha: .85) : widget.color,
        borderRadius: BorderRadius.circular(14),
        boxShadow: _pressed
            ? []
            : [
                BoxShadow(
                  color: widget.color.withValues(alpha: .3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(widget.icon, color: _bg, size: 18),
          const SizedBox(width: 8),
          Text(
            widget.label,
            style: const TextStyle(
              color: _bg,
              fontSize: 13,
              fontWeight: FontWeight.w900,
              letterSpacing: .4,
            ),
          ),
        ],
      ),
    ),
  );
}

// ─── KPI Grid ─────────────────────────────────────────────────────────────────
class _KpiGrid extends StatelessWidget {
  final AuditorDashboardData data;
  const _KpiGrid({required this.data});

  @override
  Widget build(BuildContext context) {
    final a = data.analytics;
    final cur = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    final kpis = [
      _KpiData(
        label: 'Revenue',
        value: _fmtMoney(a.revenue),
        trend: a.comparison(a.revenue, a.priorRevenue),
        up: a.revenue >= a.priorRevenue,
        icon: Icons.trending_up_rounded,
        color: _emerald,
      ),
      _KpiData(
        label: 'ADR',
        value: cur.format(a.adr),
        trend: a.comparison(a.adr, a.priorAdr),
        up: a.adr >= a.priorAdr,
        icon: Icons.king_bed_rounded,
        color: _sky,
      ),
      _KpiData(
        label: 'RevPAR',
        value: cur.format(a.revpar),
        trend: a.comparison(a.revpar, a.priorRevpar),
        up: a.revpar >= a.priorRevpar,
        icon: Icons.hotel_class_rounded,
        color: _gold,
      ),
      _KpiData(
        label: 'Net Revenue',
        value: cur.format(a.netRevenue),
        trend: a.comparison(a.netRevenue, a.priorNetRevenue),
        up: a.netRevenue >= a.priorNetRevenue,
        icon: Icons.account_balance_wallet_rounded,
        color: _violet,
      ),
      _KpiData(
        label: 'Occupancy',
        value: '${a.occupancyPercent.toStringAsFixed(1)}%',
        trend: '${a.occupiedRooms}/${a.totalRooms} rooms',
        up: true,
        icon: Icons.hotel_rounded,
        color: _amber,
      ),
      _KpiData(
        label: 'In-House',
        value: '${a.inHouseGuests}',
        trend: '${a.availableRooms} rooms avail.',
        up: true,
        icon: Icons.groups_rounded,
        color: _rose,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: kpis.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.5,
      ),
      itemBuilder: (_, i) => _KpiCard(kpi: kpis[i]),
    );
  }

  static String _fmtMoney(double v) =>
      NumberFormat.currency(symbol: '₦', decimalDigits: 0).format(v);
}

class _KpiData {
  final String label;
  final String value;
  final String trend;
  final bool up;
  final IconData icon;
  final Color color;
  const _KpiData({
    required this.label,
    required this.value,
    required this.trend,
    required this.up,
    required this.icon,
    required this.color,
  });
}

class _KpiCard extends StatelessWidget {
  final _KpiData kpi;
  const _KpiCard({required this.kpi});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: kpi.color.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(kpi.icon, color: kpi.color, size: 15),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(
                color: (kpi.up ? _emerald : _rose).withValues(alpha: .1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    kpi.up
                        ? Icons.arrow_upward_rounded
                        : Icons.arrow_downward_rounded,
                    color: kpi.up ? _emerald : _rose,
                    size: 9,
                  ),
                  const SizedBox(width: 2),
                  Text(
                    kpi.up ? 'UP' : 'DN',
                    style: TextStyle(
                      color: kpi.up ? _emerald : _rose,
                      fontSize: 7.5,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const Spacer(),
        Text(
          kpi.label,
          style: const TextStyle(
            color: _textSub,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          kpi.value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: _text,
            fontSize: 16,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          kpi.trend,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: _textDim, fontSize: 9.5),
        ),
      ],
    ),
  );
}

// ─── Operations Panel ─────────────────────────────────────────────────────────
class _OperationsPanel extends StatelessWidget {
  final AuditorDashboardData data;
  const _OperationsPanel({required this.data});

  @override
  Widget build(BuildContext context) {
    final ops = data.operations;
    final items = [
      _OpsItem(
        label: 'Arrivals',
        value: ops.arrivals,
        icon: Icons.login_rounded,
        color: _sky,
      ),
      _OpsItem(
        label: 'Departures',
        value: ops.departures,
        icon: Icons.logout_rounded,
        color: _amber,
      ),
      _OpsItem(
        label: 'In-House',
        value: ops.inHouseGuests,
        icon: Icons.groups_rounded,
        color: _violet,
      ),
      _OpsItem(
        label: 'Room Checks',
        value: ops.roomReconciliation,
        icon: Icons.bed_rounded,
        color: _rose,
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: [
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.all(14),
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.6,
            ),
            itemBuilder: (_, i) {
              final it = items[i];
              return Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: _bg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: it.color.withValues(alpha: .1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(it.icon, color: it.color, size: 15),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            it.label,
                            style: const TextStyle(
                              color: _textDim,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            '${it.value}',
                            style: TextStyle(
                              color: it.color,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _OpsItem {
  final String label;
  final int value;
  final IconData icon;
  final Color color;
  const _OpsItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
}

// ─── Close Readiness Card ─────────────────────────────────────────────────────
class _ReadinessCard extends StatelessWidget {
  final AuditorDashboardData data;
  const _ReadinessCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final issues = data.criticalDiscrepancies;
    final total =
        issues.roomStatusDiscrepancies +
        issues.occupancyDiscrepancies +
        issues.unpostedCharges +
        issues.openFolios +
        issues.reservationsRequiringAttention;
    final allClear = total == 0;
    final c = allClear ? _emerald : _rose;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.withValues(alpha: .25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: c.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  allClear ? Icons.shield_rounded : Icons.warning_amber_rounded,
                  color: c,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      allClear
                          ? 'All Controls Reconciled'
                          : '$total Open Item${total > 1 ? 's' : ''}',
                      style: TextStyle(
                        color: c,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      allClear
                          ? 'Core controls are ready for this business date.'
                          : 'Review the exception panels before running the audit.',
                      style: const TextStyle(color: _textSub, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: c.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: c.withValues(alpha: .3)),
                ),
                child: Text(
                  allClear ? 'CLEAR' : 'BLOCKED',
                  style: TextStyle(
                    color: c,
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: .8,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: allClear
                  ? 1.0
                  : (total > 10 ? 0.1 : (1 - total / 10.0).clamp(0.0, 1.0)),
              minHeight: 6,
              backgroundColor: _border,
              valueColor: AlwaysStoppedAnimation(c),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Attention Queue ──────────────────────────────────────────────────────────
class _AttentionQueue extends StatelessWidget {
  final AuditorDashboardData data;
  const _AttentionQueue({required this.data});

  @override
  Widget build(BuildContext context) {
    final c = data.controls;
    final items = [
      _QItem('Open F&B Orders', c.fnbOpenOrders, Icons.restaurant_rounded),
      _QItem(
        'Open POS Sessions',
        c.openPosSessions,
        Icons.point_of_sale_rounded,
      ),
      _QItem(
        'Front Desk Sessions',
        c.openFrontdeskSessions,
        Icons.desktop_windows_rounded,
      ),
      _QItem(
        'Sync Conflicts',
        c.financialSyncConflicts,
        Icons.sync_problem_rounded,
      ),
      _QItem(
        'Complimentary Review',
        c.unverifiedComplimentary,
        Icons.card_giftcard_rounded,
      ),
      _QItem(
        'Pending Bypasses',
        c.pendingCheckInBypasses,
        Icons.verified_user_outlined,
      ),
      _QItem(
        'Unverified Cash',
        c.unverifiedTransactions,
        Icons.payments_outlined,
      ),
      _QItem(
        'Unposted POS Orders',
        c.openPosOrders,
        Icons.receipt_long_rounded,
      ),
    ];
    final open = items.where((it) => it.value > 0).length;
    final allClear = open == 0;

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: (allClear ? _emerald : _amber).withValues(alpha: .1),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(
                    allClear
                        ? Icons.check_circle_rounded
                        : Icons.notifications_active_rounded,
                    color: allClear ? _emerald : _amber,
                    size: 16,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'ATTENTION QUEUE',
                  style: TextStyle(
                    color: _text,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: (allClear ? _emerald : _amber).withValues(alpha: .1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: (allClear ? _emerald : _amber).withValues(
                        alpha: .3,
                      ),
                    ),
                  ),
                  child: Text(
                    allClear ? 'ALL CLEAR' : '$open areas',
                    style: TextStyle(
                      color: allClear ? _emerald : _amber,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: .8,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: _border),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              children: items.map((it) => _QueueRow(item: it)).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _QItem {
  final String label;
  final int value;
  final IconData icon;
  const _QItem(this.label, this.value, this.icon);
}

class _QueueRow extends StatelessWidget {
  final _QItem item;
  const _QueueRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final open = item.value > 0;
    final c = open ? _amber : _textDim;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: c.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(item.icon, color: c, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              item.label,
              style: TextStyle(
                color: open ? _text : _textSub,
                fontSize: 12,
                fontWeight: open ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
          Container(
            constraints: const BoxConstraints(minWidth: 28),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: open ? _amber.withValues(alpha: .12) : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: open
                  ? Border.all(color: _amber.withValues(alpha: .3))
                  : null,
            ),
            child: Text(
              '${item.value}',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: open ? _amber : _textDim,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Section Label ────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;

  const _SectionLabel({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: color.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Icon(icon, color: color, size: 15),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: _text,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(color: _textDim, fontSize: 10),
            ),
          ],
        ),
      ),
    ],
  );
}

// ─── Shimmer Loader ───────────────────────────────────────────────────────────
class _ShimmerLoader extends StatefulWidget {
  final String propertyName;
  final int unread;
  const _ShimmerLoader({required this.propertyName, required this.unread});

  @override
  State<_ShimmerLoader> createState() => _ShimmerLoaderState();
}

class _ShimmerLoaderState extends State<_ShimmerLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _ctrl,
    builder: (_, __) {
      final g = LinearGradient(
        begin: Alignment(-1 + 2 * _ctrl.value - 0.3, 0),
        end: Alignment(-1 + 2 * _ctrl.value + 0.3, 0),
        colors: [_surface, _surfaceEl, _surface],
      );
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            children: [
              const SizedBox(height: 20),
              _box(g, 180, 12, r: 6),
              const SizedBox(height: 8),
              _box(g, 300, 20, r: 10),
              const SizedBox(height: 24),
              _box(g, double.infinity, 170, r: 24),
              const SizedBox(height: 20),
              _box(g, 220, 14, r: 7),
              const SizedBox(height: 10),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.5,
                children: List.generate(
                  6,
                  (_) => _box(g, double.infinity, double.infinity, r: 18),
                ),
              ),
              const SizedBox(height: 20),
              _box(g, double.infinity, 130, r: 20),
            ],
          ),
        ),
      );
    },
  );

  Widget _box(Gradient g, double w, double h, {double r = 8}) => Container(
    width: w,
    height: h,
    decoration: BoxDecoration(
      gradient: g,
      borderRadius: BorderRadius.circular(r),
    ),
  );
}

// ─── Error View ───────────────────────────────────────────────────────────────
class _ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: _rose.withValues(alpha: .1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.cloud_off_rounded, color: _rose, size: 34),
          ),
          const SizedBox(height: 20),
          const Text(
            'Audit snapshot unavailable',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _text,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            kDebugMode
                ? error.toString()
                : 'Check the connection and try again.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: _textSub, fontSize: 12),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: 160,
            child: ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _goldDark,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

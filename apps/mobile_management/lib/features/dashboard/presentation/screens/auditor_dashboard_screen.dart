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

const _auditBg = Color(0xFF070D1A);
const _auditCard = Color(0xFF111D33);
const _auditSurface = Color(0xFF1E293B);
const _auditGold = Color(0xFFD4A853);
const _auditText = Color(0xFFEEF2FF);
const _auditMuted = Color(0xFF94A3B8);

class AuditorDashboardScreen extends ConsumerWidget {
  const AuditorDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(auditorDashboardDataProvider);
    final profile = ref.watch(profileProvider);
    final unreadCount = ref.watch(unreadCountProvider);
    final selectedPropertyId = ref.watch(selectedHubPropertyProvider);

    final propertyName = profile.maybeWhen(
      data: (value) {
        final properties = value.authorization.properties;
        if (selectedPropertyId != null) {
          for (final property in properties) {
            if (property.id == selectedPropertyId) return property.name;
          }
        }
        return properties.isNotEmpty
            ? properties.first.name
            : (dashboard.value?.propertyName ?? 'LodgeCore');
      },
      orElse: () => dashboard.value?.propertyName ?? 'LodgeCore',
    );

    return Scaffold(
      backgroundColor: _auditBg,
      appBar: AppBar(
        backgroundColor: _auditBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'NIGHT AUDIT',
              style: TextStyle(
                color: _auditGold,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.8,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              propertyName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: _auditText,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                tooltip: 'Notifications',
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const NotificationsScreen(),
                  ),
                ),
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: _auditMuted,
                ),
              ),
              if (unreadCount > 0)
                Positioned(
                  right: 8,
                  top: 7,
                  child: _NotificationBadge(count: unreadCount),
                ),
            ],
          ),
          IconButton(
            tooltip: 'Profile',
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
            icon: const Icon(Icons.account_circle_outlined, color: _auditMuted),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: dashboard.when(
        data: (data) => RefreshIndicator(
          color: _auditGold,
          backgroundColor: _auditSurface,
          onRefresh: () async =>
              ref.refresh(auditorDashboardDataProvider.future),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              _buildContextBar(data),
              const SizedBox(height: 14),
              _buildActionHero(
                context,
                data,
                selectedPropertyId ?? _propertyId(ref),
                propertyName,
              ),
              const SizedBox(height: 14),
              NightAuditStatusWidget(
                status: data.auditStatus,
                businessDate: data.businessDate,
                analytics: data.analytics,
              ),
              const SizedBox(height: 14),
              _buildKpiGrid(data),
              const SizedBox(height: 14),
              _buildOperationsSnapshot(data),
              const SizedBox(height: 14),
              _buildControlQueue(data),
              const SizedBox(height: 14),
              _buildReadinessCard(data),
              const SizedBox(height: 14),
              AuditExceptionsWidget(exceptions: data.auditExceptions),
              const SizedBox(height: 14),
              DiscrepancyListWidget(discrepancies: data.criticalDiscrepancies),
              const SizedBox(height: 14),
              CashReconciliationWidget(reconciliation: data.cashReconciliation),
            ],
          ),
        ),
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _auditGold)),
        error: (error, _) => _ErrorState(
          error: error,
          onRetry: () => ref.refresh(auditorDashboardDataProvider.future),
        ),
      ),
    );
  }

  String _propertyId(WidgetRef ref) => ref.read(effectivePropertyIdProvider);

  Widget _buildContextBar(AuditorDashboardData data) {
    final updated = data.lastUpdatedAt;
    final age = DateTime.now().difference(updated).inMinutes;
    final label = age < 1 ? 'Updated just now' : 'Updated ${age}m ago';
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            color: Color(0xFF22C55E),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: _auditMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const Spacer(),
        Text(
          'Business date ${data.businessDate}',
          style: const TextStyle(color: _auditMuted, fontSize: 11),
        ),
      ],
    );
  }

  Widget _buildActionHero(
    BuildContext context,
    AuditorDashboardData data,
    String propertyId,
    String propertyName,
  ) {
    final blockers =
        data.auditStatus.blockingErrors.length +
        data.auditExceptions.criticalCount;
    final ready = blockers == 0;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            _auditCard,
            ready ? const Color(0xFF12352C) : const Color(0xFF34251F),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: (ready ? const Color(0xFF22C55E) : _auditGold).withValues(
            alpha: .28,
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: (ready ? const Color(0xFF22C55E) : _auditGold).withValues(
                alpha: .14,
              ),
              shape: BoxShape.circle,
            ),
            child: Icon(
              ready ? Icons.verified_rounded : Icons.rule_rounded,
              color: ready ? const Color(0xFF4ADE80) : _auditGold,
              size: 25,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ready
                      ? 'Ready for review'
                      : '$blockers item${blockers == 1 ? '' : 's'} need attention',
                  style: const TextStyle(
                    color: _auditText,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  ready
                      ? 'Verify the close package before posting.'
                      : 'Resolve controls before closing the business date.',
                  style: const TextStyle(
                    color: _auditMuted,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => NightAuditReviewScreen(
                  propertyId: propertyId,
                  propertyName: propertyName,
                ),
              ),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: _auditGold,
              foregroundColor: _auditBg,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'Start audit',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiGrid(AuditorDashboardData data) {
    final analytics = data.analytics;
    final currency = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.65,
      children: [
        _KpiCard(
          label: 'Last audit revenue',
          value: _money(analytics.revenue),
          detail: analytics.comparison(
            analytics.revenue,
            analytics.priorRevenue,
          ),
          icon: Icons.trending_up_rounded,
          color: const Color(0xFF4ADE80),
        ),
        _KpiCard(
          label: 'ADR',
          value: currency.format(analytics.adr),
          detail: analytics.comparison(analytics.adr, analytics.priorAdr),
          icon: Icons.king_bed_outlined,
          color: const Color(0xFF38BDF8),
        ),
        _KpiCard(
          label: 'RevPAR',
          value: currency.format(analytics.revpar),
          detail: analytics.comparison(analytics.revpar, analytics.priorRevpar),
          icon: Icons.hotel_class_outlined,
          color: _auditGold,
        ),
        _KpiCard(
          label: 'Net revenue',
          value: currency.format(analytics.netRevenue),
          detail: analytics.comparison(
            analytics.netRevenue,
            analytics.priorNetRevenue,
          ),
          icon: Icons.account_balance_wallet_outlined,
          color: const Color(0xFFA78BFA),
        ),
        _KpiCard(
          label: 'Occupancy',
          value: '${analytics.occupancyPercent.toStringAsFixed(1)}%',
          detail: '${analytics.occupiedRooms}/${analytics.totalRooms} rooms',
          icon: Icons.hotel_outlined,
          color: _auditGold,
        ),
        _KpiCard(
          label: 'In-house guests',
          value: '${analytics.inHouseGuests}',
          detail: '${analytics.availableRooms} rooms available',
          icon: Icons.groups_outlined,
          color: const Color(0xFFA78BFA),
        ),
      ],
    );
  }

  Widget _buildReadinessCard(AuditorDashboardData data) {
    final issues = data.criticalDiscrepancies;
    final total =
        issues.roomStatusDiscrepancies +
        issues.occupancyDiscrepancies +
        issues.unpostedCharges +
        issues.openFolios +
        issues.reservationsRequiringAttention;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _auditCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: .07)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.fact_check_outlined,
                color: _auditGold,
                size: 20,
              ),
              const SizedBox(width: 9),
              const Text(
                'CLOSE READINESS',
                style: TextStyle(
                  color: _auditText,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              Text(
                total == 0 ? 'CLEAR' : '$total open',
                style: TextStyle(
                  color: total == 0 ? const Color(0xFF4ADE80) : _auditGold,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: LinearProgressIndicator(
              value: total == 0 ? 1 : 0.35,
              minHeight: 7,
              backgroundColor: Colors.white.withValues(alpha: .08),
              color: total == 0 ? const Color(0xFF22C55E) : _auditGold,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            total == 0
                ? 'Core controls are reconciled for this business date.'
                : 'Review the exception panels below before running the audit.',
            style: const TextStyle(
              color: _auditMuted,
              fontSize: 12,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOperationsSnapshot(AuditorDashboardData data) {
    final operations = data.operations;
    return _sectionCard(
      title: 'OPERATIONS SNAPSHOT',
      icon: Icons.insights_rounded,
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 2.7,
        children: [
          _MiniMetric(
            label: 'Arrivals',
            value: operations.arrivals,
            icon: Icons.login_rounded,
            color: const Color(0xFF60A5FA),
          ),
          _MiniMetric(
            label: 'Departures',
            value: operations.departures,
            icon: Icons.logout_rounded,
            color: const Color(0xFFFBBF24),
          ),
          _MiniMetric(
            label: 'In-house guests',
            value: operations.inHouseGuests,
            icon: Icons.groups_rounded,
            color: const Color(0xFFA78BFA),
          ),
          _MiniMetric(
            label: 'Room checks',
            value: operations.roomReconciliation,
            icon: Icons.bed_rounded,
            color: const Color(0xFFF87171),
          ),
        ],
      ),
    );
  }

  Widget _buildControlQueue(AuditorDashboardData data) {
    final controls = data.controls;
    final items = [
      _QueueMetric(
        'Open F&B orders',
        controls.fnbOpenOrders,
        Icons.restaurant_rounded,
      ),
      _QueueMetric(
        'Open POS sessions',
        controls.openPosSessions,
        Icons.point_of_sale_rounded,
      ),
      _QueueMetric(
        'Front desk sessions',
        controls.openFrontdeskSessions,
        Icons.desktop_windows_rounded,
      ),
      _QueueMetric(
        'Sync conflicts',
        controls.financialSyncConflicts,
        Icons.sync_problem_rounded,
      ),
      _QueueMetric(
        'Complimentary review',
        controls.unverifiedComplimentary,
        Icons.card_giftcard_rounded,
      ),
      _QueueMetric(
        'Pending bypasses',
        controls.pendingCheckInBypasses,
        Icons.verified_user_outlined,
      ),
      _QueueMetric(
        'Unverified cash',
        controls.unverifiedTransactions,
        Icons.payments_outlined,
      ),
      _QueueMetric(
        'Unposted POS orders',
        controls.openPosOrders,
        Icons.receipt_long_rounded,
      ),
    ];
    final open = items.where((item) => item.value > 0).length;
    return _sectionCard(
      title: 'ATTENTION QUEUE',
      icon: Icons.notifications_active_outlined,
      trailing: Text(
        open == 0 ? 'CLEAR' : '$open areas',
        style: TextStyle(
          color: open == 0 ? const Color(0xFF4ADE80) : _auditGold,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
      child: Column(
        children: items.map((item) => _QueueRow(item: item)).toList(),
      ),
    );
  }

  Widget _sectionCard({
    required String title,
    required IconData icon,
    required Widget child,
    Widget? trailing,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _auditCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: .07)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: _auditGold, size: 19),
              const SizedBox(width: 9),
              Text(
                title,
                style: const TextStyle(
                  color: _auditText,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.15,
                ),
              ),
              const Spacer(),
              ?trailing,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  String _money(double amount) =>
      NumberFormat.currency(symbol: '₦', decimalDigits: 0).format(amount);
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String? detail;
  final IconData icon;
  final Color color;
  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.detail,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _auditCard,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: .06)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: color, size: 17),
            const Spacer(),
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .8),
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
        const Spacer(),
        Text(
          label,
          style: const TextStyle(
            color: _auditMuted,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: _auditText,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        if (detail != null)
          Text(
            detail!,
            style: const TextStyle(color: _auditMuted, fontSize: 10),
          ),
      ],
    ),
  );
}

class _MiniMetric extends StatelessWidget {
  final String label;
  final int value;
  final IconData icon;
  final Color color;
  const _MiniMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
    decoration: BoxDecoration(
      color: _auditSurface.withValues(alpha: .55),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      children: [
        Icon(icon, color: color, size: 17),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            maxLines: 2,
            style: const TextStyle(
              color: _auditMuted,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text(
          '$value',
          style: const TextStyle(
            color: _auditText,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _QueueMetric {
  final String label;
  final int value;
  final IconData icon;
  const _QueueMetric(this.label, this.value, this.icon);
}

class _QueueRow extends StatelessWidget {
  final _QueueMetric item;
  const _QueueRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final open = item.value > 0;
    final color = open ? const Color(0xFFFBBF24) : const Color(0xFF64748B);
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(item.icon, color: color, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              item.label,
              style: const TextStyle(
                color: _auditText,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            '${item.value}',
            style: TextStyle(
              color: open ? color : _auditMuted,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationBadge extends StatelessWidget {
  final int count;
  const _NotificationBadge({required this.count});
  @override
  Widget build(BuildContext context) => Container(
    width: 15,
    height: 15,
    alignment: Alignment.center,
    decoration: const BoxDecoration(
      color: Color(0xFFEF4444),
      shape: BoxShape.circle,
    ),
    child: Text(
      count > 9 ? '9+' : '$count',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 8,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _ErrorState extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const _ErrorState({required this.error, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _auditMuted, size: 52),
          const SizedBox(height: 14),
          const Text(
            'Unable to load the audit snapshot',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _auditText,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            kDebugMode
                ? error.toString()
                : 'Check the connection and try again.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: _auditMuted, fontSize: 12),
          ),
          const SizedBox(height: 20),
          OutlinedButton(
            onPressed: onRetry,
            style: OutlinedButton.styleFrom(
              foregroundColor: _auditGold,
              side: const BorderSide(color: _auditGold),
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    ),
  );
}

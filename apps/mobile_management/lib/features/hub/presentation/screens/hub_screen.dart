import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../data/hub_model.dart';
import '../../providers/hub_provider.dart';
import '../../../approvals/presentation/screens/approvals_screen.dart';
import '../../../finance/presentation/screens/finance_screen.dart';
import '../../../fnb/presentation/screens/fnb_screen.dart';
import '../../../rooms/presentation/screens/rooms_screen.dart';
import '../widgets/property_filter_dropdown.dart';
import 'global_search_screen.dart';

const _ink = Color(0xFF070D1A);
const _panel = Color(0xFF101B30);
const _panelRaised = Color(0xFF16243D);
const _line = Color(0xFF243653);
const _gold = Color(0xFFD8AD52);
const _blue = Color(0xFF55B9F2);
const _green = Color(0xFF42D392);
const _red = Color(0xFFF07478);
const _orange = Color(0xFFF3A557);
const _white = Color(0xFFF1F5FF);
const _muted = Color(0xFF91A2BF);
const _faint = Color(0xFF647594);

/// The Hub is the management control centre: a place to decide, coordinate,
/// and verify operations. It deliberately avoids duplicating the KPI-heavy
/// Executive dashboard.
class HubScreen extends ConsumerWidget {
  const HubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(hubDataProvider);
    final date = DateFormat('EEE, d MMM yyyy').format(DateTime.now());

    return Scaffold(
      backgroundColor: _ink,
      appBar: AppBar(
        backgroundColor: _ink,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 20,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.grid_view_rounded, color: _gold, size: 18),
                SizedBox(width: 8),
                Text(
                  'CONTROL CENTRE',
                  style: TextStyle(
                    color: _white,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(date, style: const TextStyle(color: _faint, fontSize: 11)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Search PMS',
            icon: const Icon(Icons.search_rounded, color: _muted),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const GlobalSearchScreen()),
            ),
          ),
          const SizedBox(width: 8),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(58),
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, 2, 20, 12),
            child: PropertyFilterDropdown(),
          ),
        ),
      ),
      body: state.when(
        loading: () => const _HubLoading(),
        error: (error, _) => _HubError(
          error: error,
          onRetry: () => ref.invalidate(hubDataProvider),
        ),
        data: (data) => _HubBody(
          data: data,
          onRefresh: () async => ref.invalidate(hubDataProvider),
        ),
      ),
    );
  }
}

class _HubBody extends StatefulWidget {
  final HubData data;
  final Future<void> Function() onRefresh;

  const _HubBody({required this.data, required this.onRefresh});

  @override
  State<_HubBody> createState() => _HubBodyState();
}

class _HubBodyState extends State<_HubBody> {
  final _decisionQueueKey = GlobalKey();

  void _reviewQueue() {
    final target = _decisionQueueKey.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(
      target,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
      alignment: .08,
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final attentionCount = _attentionCount(data);
    final freshness = _freshnessLabel(data.systemStatus);

    return RefreshIndicator(
      color: _gold,
      backgroundColor: _panelRaised,
      onRefresh: widget.onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          _buildIdentityCard(
            propertyName: _propertyLabel(data),
            attentionCount: attentionCount,
            freshness: freshness,
          ),
          const SizedBox(height: 18),
          _SectionHeading(
            label: 'DECISION QUEUE',
            caption: attentionCount == 0
                ? 'Nothing requires your attention'
                : '$attentionCount items need review',
          ),
          const SizedBox(height: 10),
          KeyedSubtree(
            key: _decisionQueueKey,
            child: _buildDecisionQueue(context, data, attentionCount),
          ),
          const SizedBox(height: 22),
          _SectionHeading(
            label: 'WORKSPACES',
            caption: 'Open an operational area',
          ),
          const SizedBox(height: 10),
          _buildWorkspaces(context, data.modules, data.systemStatus),
          const SizedBox(height: 22),
          _SectionHeading(
            label: 'PROPERTY CONFIDENCE',
            caption: 'Connectivity and data freshness',
          ),
          const SizedBox(height: 10),
          _buildConfidence(data.systemStatus),
        ],
      ),
    );
  }

  int _attentionCount(HubData data) {
    final alerts = data.alerts;
    return data.approvalsSummary.totalPending +
        alerts.oooRooms +
        alerts.cashVariances +
        alerts.offlineTerminals;
  }

  String _propertyLabel(HubData data) {
    if (data.scope.property == 'ALL_AUTHORIZED') {
      return 'All authorized properties';
    }
    for (final property in data.scope.availableProperties) {
      if (property.id == data.scope.property) return property.name;
    }
    return 'Selected property';
  }

  String _freshnessLabel(SystemStatus status) {
    if (status.lastSync != null) {
      return 'Terminal sync ${DateFormat('HH:mm').format(status.lastSync!)}';
    }
    if (status.dataAsOf != null) {
      return 'Hub refreshed ${DateFormat('HH:mm').format(status.dataAsOf!)}';
    }
    return 'Refresh time unavailable';
  }

  Widget _buildIdentityCard({
    required String propertyName,
    required int attentionCount,
    required String freshness,
  }) {
    final hasAttention = attentionCount > 0;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_panelRaised, _panel],
        ),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _gold.withValues(alpha: .13),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.tune_rounded, color: _gold, size: 22),
              ),
              const Spacer(),
              _StatusPill(
                label: hasAttention ? 'REVIEW NEEDED' : 'ALL CLEAR',
                color: hasAttention ? _orange : _green,
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Text(
            'One place to run the property',
            style: TextStyle(
              color: _white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            propertyName.isEmpty ? 'Selected property' : propertyName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _gold,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            hasAttention
                ? 'Resolve exceptions and approvals before they become guest-impacting issues.'
                : 'Operations are in control. Use a workspace to inspect or act.',
            style: const TextStyle(color: _muted, fontSize: 13, height: 1.45),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _IdentityMetric(
                value: '$attentionCount',
                label: 'open items',
                color: hasAttention ? _orange : _green,
              ),
              const SizedBox(width: 22),
              _IdentityMetric(
                value:
                    '${DateTime.now().hour.toString().padLeft(2, '0')}:${DateTime.now().minute.toString().padLeft(2, '0')}',
                label: 'local time',
                color: _blue,
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  freshness,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: _faint, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _reviewQueue,
                  icon: const Icon(Icons.fact_check_outlined, size: 16),
                  label: Text(hasAttention ? 'Review queue' : 'View queue'),
                  style: FilledButton.styleFrom(
                    backgroundColor: _gold,
                    foregroundColor: _ink,
                    minimumSize: const Size.fromHeight(42),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 46,
                height: 42,
                child: OutlinedButton(
                  onPressed: () {
                    widget.onRefresh();
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _muted,
                    side: const BorderSide(color: _line),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: EdgeInsets.zero,
                  ),
                  child: const Icon(Icons.refresh_rounded, size: 18),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDecisionQueue(
    BuildContext context,
    HubData data,
    int attentionCount,
  ) {
    if (attentionCount == 0) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _panel,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _line),
        ),
        child: const Row(
          children: [
            Icon(Icons.verified_rounded, color: _green, size: 22),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'No exceptions, approval requests, or device issues are open.',
                style: TextStyle(color: _muted, fontSize: 13, height: 1.4),
              ),
            ),
          ],
        ),
      );
    }

    final rows = <Widget>[];
    final alerts = data.alerts;
    if (alerts.oooRooms > 0) {
      rows.add(
        _QueueRow(
          icon: Icons.hotel_rounded,
          title: 'Rooms out of order',
          detail:
              '${alerts.oooRooms} room${alerts.oooRooms == 1 ? '' : 's'} require engineering or housekeeping follow-up',
          color: _red,
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const RoomsScreen())),
        ),
      );
    }
    if (alerts.cashVariances > 0) {
      rows.add(
        _QueueRow(
          icon: Icons.account_balance_wallet_rounded,
          title: 'Cash variances',
          detail:
              '${alerts.cashVariances} shift${alerts.cashVariances == 1 ? '' : 's'} need reconciliation',
          color: _orange,
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const FinanceScreen())),
        ),
      );
    }
    if (alerts.offlineTerminals > 0) {
      rows.add(
        _QueueRow(
          icon: Icons.wifi_off_rounded,
          title: 'Offline terminals',
          detail:
              '${alerts.offlineTerminals} device${alerts.offlineTerminals == 1 ? '' : 's'} are not reporting',
          color: _orange,
          onTap: () => _showTerminalStatus(context, data.systemStatus),
        ),
      );
    }
    if (data.approvalsSummary.totalPending > 0) {
      rows.add(
        _QueueRow(
          icon: Icons.fact_check_rounded,
          title: 'Pending approvals',
          detail:
              '${data.approvalsSummary.totalPending} request${data.approvalsSummary.totalPending == 1 ? '' : 's'} awaiting a management decision',
          color: _gold,
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const ApprovalsScreen())),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            rows[i],
            if (i != rows.length - 1)
              const Divider(color: _line, height: 1, indent: 56, endIndent: 16),
          ],
        ],
      ),
    );
  }

  void _showTerminalStatus(BuildContext context, SystemStatus status) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: _panel,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Terminal connectivity',
                style: TextStyle(
                  color: _white,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Terminals are considered offline when they have not reported within the last five minutes.',
                style: TextStyle(color: _muted, fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 18),
              _TerminalStatusLine(
                label: 'Front desk',
                value:
                    '${status.frontDeskOnline.online} / ${status.frontDeskOnline.total} online',
                color: _blue,
              ),
              const SizedBox(height: 10),
              _TerminalStatusLine(
                label: 'Point of sale',
                value:
                    '${status.posOnline.online} / ${status.posOnline.total} online',
                color: _gold,
              ),
              const SizedBox(height: 16),
              Text(
                status.lastSync == null
                    ? 'No terminal sync has been recorded.'
                    : 'Last terminal sync: ${DateFormat('EEE, d MMM · HH:mm').format(status.lastSync!)}',
                style: const TextStyle(color: _faint, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWorkspaces(
    BuildContext context,
    List<HubModule> modules,
    SystemStatus status,
  ) {
    if (modules.isEmpty) {
      return const _EmptyPanel(
        icon: Icons.widgets_outlined,
        message: 'No additional workspaces are enabled for this account.',
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: modules.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.45,
      ),
      itemBuilder: (_, index) {
        final module = modules[index];
        final color = _workspaceColor(index);
        return Material(
          color: _panel,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            onTap: () => _openWorkspace(context, module, status),
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: _line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Icon(
                          _iconFor(module.icon),
                          color: color,
                          size: 18,
                        ),
                      ),
                      const Spacer(),
                      Icon(
                        module.enabled
                            ? Icons.arrow_forward_rounded
                            : Icons.lock_outline_rounded,
                        color: module.enabled ? _muted : _faint,
                        size: 16,
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    module.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    module.enabled ? 'Workspace' : 'Restricted',
                    style: TextStyle(
                      color: module.enabled ? _muted : _faint,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _openWorkspace(
    BuildContext context,
    HubModule module,
    SystemStatus status,
  ) {
    if (!module.enabled) {
      _showWorkspaceMessage(
        context,
        module.title,
        'This workspace is restricted for your role.',
      );
      return;
    }

    final Widget? destination = switch (module.id) {
      'finance' || 'reports' => const FinanceScreen(),
      'pos' => const FnbScreen(),
      'housekeeping' => const RoomsScreen(),
      'reservations' || 'guests' => const GlobalSearchScreen(),
      _ => null,
    };

    if (destination != null) {
      Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => destination));
      return;
    }

    if (module.id == 'sync') {
      _showTerminalStatus(context, status);
      return;
    }

    _showWorkspaceMessage(
      context,
      module.title,
      'This workspace is available in the full PMS console.',
    );
  }

  void _showWorkspaceMessage(
    BuildContext context,
    String title,
    String message,
  ) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: _panel,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline_rounded, color: _gold),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: _white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      message,
                      style: const TextStyle(
                        color: _muted,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildConfidence(SystemStatus status) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 8),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
      child: Column(
        children: [
          _ConfidenceRow(
            icon: Icons.cloud_done_rounded,
            label: 'Cloud connection',
            detail: status.cloudConnected
                ? 'Connected and reporting'
                : 'Connection unavailable',
            color: status.cloudConnected ? _green : _red,
          ),
          const Divider(color: _line, height: 1),
          _ConfidenceRow(
            icon: Icons.desktop_windows_rounded,
            label: 'Front desk',
            detail:
                '${status.frontDeskOnline.online} of ${status.frontDeskOnline.total} online',
            color: _blue,
          ),
          const Divider(color: _line, height: 1),
          _ConfidenceRow(
            icon: Icons.point_of_sale_rounded,
            label: 'Point of sale',
            detail:
                '${status.posOnline.online} of ${status.posOnline.total} online',
            color: _gold,
          ),
        ],
      ),
    );
  }

  Color _workspaceColor(int index) =>
      [_blue, _gold, _green, _orange, const Color(0xFFB294F6)][index % 5];

  IconData _iconFor(String name) {
    const icons = <String, IconData>{
      'book_online': Icons.book_online_rounded,
      'people': Icons.people_alt_rounded,
      'account_balance': Icons.account_balance_rounded,
      'assessment': Icons.assessment_rounded,
      'point_of_sale': Icons.point_of_sale_rounded,
      'cleaning_services': Icons.cleaning_services_rounded,
      'build': Icons.build_rounded,
      'badge': Icons.badge_rounded,
      'security': Icons.security_rounded,
      'sync': Icons.sync_rounded,
    };
    return icons[name] ?? Icons.widgets_rounded;
  }
}

class _SectionHeading extends StatelessWidget {
  final String label;
  final String caption;
  const _SectionHeading({required this.label, required this.caption});

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.end,
    children: [
      Expanded(
        child: Text(
          label,
          style: const TextStyle(
            color: _white,
            fontSize: 13,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.1,
          ),
        ),
      ),
      Flexible(
        child: Text(
          caption,
          textAlign: TextAlign.right,
          style: const TextStyle(color: _faint, fontSize: 11),
        ),
      ),
    ],
  );
}

class _StatusPill extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusPill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withValues(alpha: .28)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 9,
            fontWeight: FontWeight.w800,
            letterSpacing: .7,
          ),
        ),
      ],
    ),
  );
}

class _IdentityMetric extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  const _IdentityMetric({
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(color: _faint, fontSize: 10)),
    ],
  );
}

class _QueueRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  final Color color;
  final VoidCallback onTap;
  const _QueueRow({
    required this.icon,
    required this.title,
    required this.detail,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 16),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: _white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    detail,
                    style: const TextStyle(
                      color: _muted,
                      fontSize: 11,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: _faint, size: 19),
          ],
        ),
      ),
    ),
  );
}

class _TerminalStatusLine extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _TerminalStatusLine({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          label,
          style: const TextStyle(
            color: _white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _ConfidenceRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String detail;
  final Color color;
  const _ConfidenceRow({
    required this.icon,
    required this.label,
    required this.detail,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: _white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text(detail, style: const TextStyle(color: _muted, fontSize: 11)),
      ],
    ),
  );
}

class _EmptyPanel extends StatelessWidget {
  final IconData icon;
  final String message;
  const _EmptyPanel({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _panel,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _line),
    ),
    child: Row(
      children: [
        Icon(icon, color: _faint),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(color: _muted, fontSize: 12, height: 1.35),
          ),
        ),
      ],
    ),
  );
}

class _HubLoading extends StatelessWidget {
  const _HubLoading();

  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator(color: _gold));
}

class _HubError extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const _HubError({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _orange, size: 42),
          const SizedBox(height: 14),
          const Text(
            'Control centre unavailable',
            style: TextStyle(
              color: _white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            'We could not load the latest property status.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: _muted, fontSize: 13),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try again'),
            style: OutlinedButton.styleFrom(
              foregroundColor: _gold,
              side: const BorderSide(color: _gold),
            ),
          ),
        ],
      ),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../providers/hub_provider.dart';
import '../widgets/property_filter_dropdown.dart';
import '../../data/hub_model.dart';
import 'global_search_screen.dart';

// ─── Design Tokens ───────────────────────────────────────────────────────────
const _bgDeep = Color(0xFF070D1A);
const _cardBg = Color(0xFF111D33);
const _surfaceNavy = Color(0xFF1E293B);
const _goldLight = Color(0xFFD4A853);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);
const _textMuted = Color(0xFF6B7FA3);
const _red = Color(0xFFEF4444);
const _orange = Color(0xFFF97316);
const _green = Color(0xFF22C55E);

class HubScreen extends ConsumerWidget {
  const HubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hubState = ref.watch(hubDataProvider);
    final todayStr = DateFormat('dd MMM yyyy').format(DateTime.now());

    return Scaffold(
      backgroundColor: _bgDeep,
      appBar: AppBar(
        backgroundColor: _bgDeep,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('HUB', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textPrimary, letterSpacing: 1.2)),
            Text(todayStr, style: const TextStyle(fontSize: 12, color: _textMuted)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: _textPrimary),
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(
                builder: (ctx) => const GlobalSearchScreen(),
              ));
            },
          ),
          const SizedBox(width: 8),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            alignment: Alignment.centerLeft,
            child: const PropertyFilterDropdown(),
          ),
        ),
      ),
      body: hubState.when(
        loading: () => const Center(child: CircularProgressIndicator(color: _goldLight)),
        error: (err, _) => _buildError(err, ref),
        data: (data) => _buildBody(context, data, ref),
      ),
    );
  }

  Widget _buildError(Object err, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: _red, size: 48),
          const SizedBox(height: 16),
          Text(err.toString(), style: const TextStyle(color: _textPrimary), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => ref.invalidate(hubDataProvider),
            child: const Text('Retry', style: TextStyle(color: _goldLight)),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, HubData data, WidgetRef ref) {
    return RefreshIndicator(
      color: _goldLight,
      backgroundColor: _surfaceNavy,
      onRefresh: () async => ref.invalidate(hubDataProvider),
      child: ListView(
        padding: const EdgeInsets.symmetric(vertical: 16.0),
        children: [
          _buildAlerts(data.alerts),
          _buildDivider(),
          _buildManagementGrid(data.modules),
          _buildDivider(),
          _buildApprovals(data.approvalsSummary),
          _buildDivider(),
          _buildQuickActions(),
          _buildDivider(),
          _buildSystemStatus(data.systemStatus),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 24.0, horizontal: 16.0),
      child: Divider(color: _surfaceNavy, height: 1),
    );
  }

  Widget _buildAlerts(HubAlerts alerts) {
    final hasAlerts = alerts.oooRooms > 0 || alerts.cashVariances > 0 || alerts.offlineTerminals > 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(hasAlerts ? Icons.warning_amber_rounded : Icons.check_circle_outline, 
                   color: hasAlerts ? _goldLight : _green, size: 18),
              const SizedBox(width: 8),
              const Text('REQUIRES ATTENTION', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            ],
          ),
          const SizedBox(height: 16),
          if (!hasAlerts)
            const Text('All clear. No immediate action required.', style: TextStyle(color: _textSecondary, fontSize: 14)),
          if (alerts.oooRooms > 0)
            _buildAlertRow(Icons.hotel, '${alerts.oooRooms} Rooms Out of Order', _red),
          if (alerts.cashVariances > 0)
            _buildAlertRow(Icons.account_balance_wallet, '${alerts.cashVariances} Cash Variances', _orange),
          if (alerts.offlineTerminals > 0)
            _buildAlertRow(Icons.wifi_off, '${alerts.offlineTerminals} Terminals Offline', _orange),
        ],
      ),
    );
  }

  Widget _buildAlertRow(IconData icon, String text, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 12),
          Text(text, style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildManagementGrid(List<HubModule> modules) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('MANAGEMENT', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 2.5,
            ),
            itemCount: modules.length,
            itemBuilder: (context, index) {
              final mod = modules[index];
              return Material(
                color: _cardBg,
                borderRadius: BorderRadius.circular(8),
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () {
                    // Navigate to module
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: _surfaceNavy),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(_getIconForModule(mod.icon), color: _goldLight, size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(mod.title, style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  IconData _getIconForModule(String iconName) {
    switch (iconName) {
      case 'book_online': return Icons.book_online;
      case 'people': return Icons.people;
      case 'account_balance': return Icons.account_balance;
      case 'assessment': return Icons.assessment;
      case 'point_of_sale': return Icons.point_of_sale;
      case 'cleaning_services': return Icons.cleaning_services;
      case 'build': return Icons.build;
      case 'badge': return Icons.badge;
      case 'security': return Icons.security;
      case 'sync': return Icons.sync;
      default: return Icons.widgets;
    }
  }

  Widget _buildApprovals(ApprovalsSummary summary) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('APPROVALS', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 16),
          Text('${summary.totalPending} Pending', style: const TextStyle(color: _textPrimary, fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          if (summary.byType.isNotEmpty)
            Text(
              summary.byType.map((t) => '${t.type} ${t.count}').join(' • '),
              style: const TextStyle(color: _textSecondary, fontSize: 13),
            ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {},
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('View All', style: TextStyle(color: _goldLight, fontSize: 13, fontWeight: FontWeight.w600)),
                  SizedBox(width: 4),
                  Icon(Icons.arrow_forward, color: _goldLight, size: 14),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('QUICK ACTIONS', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              _buildActionLink('Arrivals'),
              _buildActionLink('Departures'),
              _buildActionLink('Rooms'),
              _buildActionLink('Cash'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionLink(String label) {
    return InkWell(
      onTap: () {},
      child: Text(label, style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
    );
  }

  Widget _buildSystemStatus(SystemStatus status) {
    final lastSyncStr = status.lastSync != null ? DateFormat('HH:mm').format(status.lastSync!) : 'Never';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('SYSTEM STATUS', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(Icons.cloud_done, color: status.cloudConnected ? _green : _red, size: 16),
              const SizedBox(width: 8),
              const Text('Cloud Connected', style: TextStyle(color: _textPrimary, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Front Desk', style: TextStyle(color: _textSecondary, fontSize: 14)),
                  const SizedBox(width: 8),
                  Text('${status.frontDeskOnline.online}/${status.frontDeskOnline.total}', style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('POS', style: TextStyle(color: _textSecondary, fontSize: 14)),
                  const SizedBox(width: 8),
                  Text('${status.posOnline.online}/${status.posOnline.total}', style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Last sync: $lastSyncStr', style: const TextStyle(color: _textMuted, fontSize: 12)),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

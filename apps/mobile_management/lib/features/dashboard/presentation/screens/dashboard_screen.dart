import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/dashboard_provider.dart';
import 'package:mobile_management/features/notifications/presentation/providers/notifications_provider.dart';
import 'package:mobile_management/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:mobile_management/features/profile/presentation/screens/profile_screen.dart';
import '../widgets/director/executive_kpi_row.dart';
import '../widgets/director/requires_attention_card.dart';
import '../widgets/director/today_snapshot_widget.dart';
import '../widgets/director/performance_trend_chart.dart';
import '../widgets/director/compact_room_status_widget.dart';
import '../widgets/director/sync_summary_widget.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const primaryNavy = Color(0xFF0F172A);
    const textSecondary = Color(0xFF94A3B8);
    const goldAccent = Color(0xFFD4AF37);
    const textPrimary = Color(0xFFF8FAFC);
    const surfaceNavy = Color(0xFF1E293B);

    final dashboardState = ref.watch(dashboardDataProvider);
    final unreadCount = ref.watch(unreadCountProvider);

    return Scaffold(
      backgroundColor: primaryNavy,
      appBar: AppBar(
        backgroundColor: primaryNavy,
        elevation: 0,
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'LODGECORE HOTELS',
              style: TextStyle(
                fontSize: 10,
                letterSpacing: 2.0,
                fontWeight: FontWeight.w700,
                color: goldAccent,
              ),
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  dashboardState.value?.propertyName ?? 'LodgeCore',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.arrow_drop_down, color: textSecondary, size: 24),
              ],
            ),
            if (dashboardState.value != null) ...[
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(Icons.circle, color: Colors.greenAccent, size: 8),
                  const SizedBox(width: 4),
                  Text(
                    'Live · Updated ${_getTimeAgo(dashboardState.value!.lastUpdatedAt)}',
                    style: const TextStyle(color: textSecondary, fontSize: 10, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ],
          ],
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: textSecondary),
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen()));
                },
              ),
              if (unreadCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.redAccent,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      unreadCount > 99 ? '99+' : unreadCount.toString(),
                      style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
            },
            child: const CircleAvatar(
              radius: 16,
              backgroundColor: surfaceNavy,
              child: Icon(Icons.person, color: goldAccent, size: 20),
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: dashboardState.when(
        data: (data) {
          return RefreshIndicator(
            onRefresh: () async {
              return ref.refresh(dashboardDataProvider.future);
            },
            color: goldAccent,
            backgroundColor: surfaceNavy,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              children: [
                ExecutiveKpiRow(overview: data.executiveOverview, businessDate: data.businessDate),
                if (data.requiresAttention.isNotEmpty) const SizedBox(height: 24),
                if (data.requiresAttention.isNotEmpty) RequiresAttentionCard(alerts: data.requiresAttention),
                const SizedBox(height: 24),
                CompactRoomStatusWidget(summary: data.roomSummary),
                const SizedBox(height: 24),
                PerformanceTrendChart(trends: data.performanceTrends),
                const SizedBox(height: 24),
                TodaySnapshotWidget(snapshot: data.todaySnapshot),
                const SizedBox(height: 24),
                SyncSummaryWidget(summary: data.syncSummary),
                const SizedBox(height: 48), // Bottom padding
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: goldAccent)),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off, color: textSecondary, size: 48),
              const SizedBox(height: 16),
              const Text(
                'Unable to load live dashboard',
                style: TextStyle(color: textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Check your connection and try again.',
                style: TextStyle(color: textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.refresh(dashboardDataProvider.future),
                style: ElevatedButton.styleFrom(
                  backgroundColor: surfaceNavy,
                  foregroundColor: goldAccent,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getTimeAgo(DateTime date) {
    final difference = DateTime.now().difference(date);
    if (difference.inMinutes < 1) return 'just now';
    if (difference.inMinutes < 60) return '${difference.inMinutes} min ago';
    if (difference.inHours < 24) return '${difference.inHours} hours ago';
    return '${difference.inDays} days ago';
  }
}

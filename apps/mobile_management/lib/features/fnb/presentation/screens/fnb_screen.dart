import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/fnb_provider.dart';
import '../models/fnb_dashboard_data.dart';
import '../widgets/fnb_hero_card.dart';
import '../widgets/fnb_outlet_cards.dart';
import '../widgets/fnb_top_items.dart';
import '../widgets/fnb_hourly_chart.dart';
import '../widgets/fnb_revenue_trend.dart';
import '../widgets/fnb_payment_breakdown.dart';
import '../widgets/fnb_operations_strip.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _bgDeep  = Color(0xFF070D1A);
const _surface = Color(0xFF111827);
const _border  = Color(0xFF1E3048);
const _emerald = Color(0xFF10B981);
const _textPrimary   = Color(0xFFF8FAFC);
const _textMuted     = Color(0xFF64748B);

class FnbScreen extends ConsumerWidget {
  const FnbScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(fnbDashboardProvider);

    return Scaffold(
      backgroundColor: _bgDeep,
      body: state.when(
        loading: () => const _LoadingView(),
        error: (err, _) => _ErrorView(error: err, onRetry: () => ref.invalidate(fnbDashboardProvider)),
        data: (data) => _FnbBody(data: data, onRefresh: () async => ref.invalidate(fnbDashboardProvider)),
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
                border: Border(bottom: BorderSide(color: Color(0xFF1E3048), width: 0.5)),
              ),
            ),
            title: Row(
              children: [
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    color: _emerald.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _emerald.withValues(alpha: 0.25)),
                  ),
                  child: const Icon(Icons.restaurant_rounded, color: _emerald, size: 16),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'F&B',
                      style: TextStyle(
                        color: _textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      'As of $timeStr',
                      style: const TextStyle(color: _textMuted, fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
            actions: [
              Container(
                margin: const EdgeInsets.only(right: 16),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: _surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: const BoxDecoration(color: _emerald, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 5),
                    const Text('LIVE', style: TextStyle(color: _emerald, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1)),
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

                // 1. HERO REVENUE CARD
                FnbHeroCard(
                  summary: data.summary,
                  businessDate: data.businessDate,
                ),

                // 2. OUTLET PERFORMANCE
                if (data.outletBreakdown.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionHeader(
                    icon: Icons.storefront_rounded,
                    title: 'OUTLET PERFORMANCE',
                    subtitle: '${data.outletBreakdown.length} active outlet${data.outletBreakdown.length == 1 ? '' : 's'}',
                  ),
                  const SizedBox(height: 12),
                  FnbOutletCards(outlets: data.outletBreakdown),
                ],

                // 3. TOP SELLING ITEMS
                if (data.topSellingItems.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionHeader(
                    icon: Icons.emoji_events_rounded,
                    title: 'TOP SELLING ITEMS',
                    subtitle: 'By revenue today',
                  ),
                  const SizedBox(height: 12),
                  FnbTopItems(items: data.topSellingItems),
                ],

                // 4. HOURLY REVENUE
                if (data.hourlyRevenue.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionHeader(
                    icon: Icons.schedule_rounded,
                    title: 'REVENUE BY HOUR',
                    subtitle: 'Order-time based · operational',
                  ),
                  const SizedBox(height: 12),
                  FnbHourlyChart(hourlyData: data.hourlyRevenue),
                ],

                // 5. 7-DAY REVENUE TREND
                if (data.revenueBy7Days.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionHeader(
                    icon: Icons.bar_chart_rounded,
                    title: '7-DAY TREND',
                    subtitle: 'Food · Beverage · Bar',
                  ),
                  const SizedBox(height: 12),
                  FnbRevenueTrend(days: data.revenueBy7Days),
                ],

                // 6. PAYMENT BREAKDOWN
                if (data.paymentBreakdown.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionHeader(
                    icon: Icons.credit_card_rounded,
                    title: 'PAYMENT BREAKDOWN',
                    subtitle: 'Settled orders today',
                  ),
                  const SizedBox(height: 12),
                  FnbPaymentBreakdown(payments: data.paymentBreakdown),
                ],

                // 7. POS OPERATIONS
                const SizedBox(height: 28),
                _SectionHeader(
                  icon: Icons.point_of_sale_rounded,
                  title: 'POS OPERATIONS',
                  subtitle: 'Terminals · Sessions · Exceptions',
                ),
                const SizedBox(height: 12),
                FnbOperationsStrip(
                  ops: data.posOperations,
                  summary: data.summary,
                ),

                const SizedBox(height: 24),
                // Disclaimer
                Text(
                  '* Revenue figures are authoritative from the LodgeCore accounting engine.\n'
                  '  Hourly chart uses order-creation time (operational view).\n'
                  '  Void rate is item-count based. All figures reflect business date ${data.businessDate}.',
                  style: const TextStyle(color: _textMuted, fontSize: 9, height: 1.6),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
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
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: _emerald.withValues(alpha: 0.1),
                shape: BoxShape.circle,
                border: Border.all(color: _emerald.withValues(alpha: 0.2)),
              ),
              child: const Icon(Icons.restaurant_rounded, color: _emerald, size: 24),
            ),
            const SizedBox(height: 20),
            const SizedBox(
              width: 24, height: 24,
              child: CircularProgressIndicator(color: _emerald, strokeWidth: 2),
            ),
            const SizedBox(height: 16),
            const Text('Loading F&B Analytics…', style: TextStyle(color: _textMuted, fontSize: 13)),
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
              const Icon(Icons.restaurant_outlined, color: _textMuted, size: 48),
              const SizedBox(height: 16),
              const Text(
                'Could not load F&B data',
                style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
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
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    color: _emerald.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _emerald.withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    'Try Again',
                    style: TextStyle(color: _emerald, fontWeight: FontWeight.w700, fontSize: 14),
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

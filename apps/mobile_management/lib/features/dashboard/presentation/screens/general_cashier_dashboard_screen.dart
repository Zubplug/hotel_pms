
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../approvals/presentation/providers/approvals_provider.dart';
import '../../../approvals/presentation/screens/approvals_screen.dart';
import '../../../finance/presentation/providers/finance_provider.dart';
import '../../../finance/presentation/models/finance_data.dart';
import '../../../notifications/presentation/providers/notifications_provider.dart';
import '../../../notifications/presentation/screens/notifications_screen.dart';
import '../../../profile/presentation/screens/profile_screen.dart';
import 'cashier_shifts_screen.dart';

// ─── Design Tokens ──────────────────────────────────────────────────────────
const _bg       = Color(0xFF060E1A);
const _surface  = Color(0xFF0D1B2E);
const _surfaceEl= Color(0xFF132338);
const _border   = Color(0xFF1E3352);

const _text     = Color(0xFFF0F5FF);
const _textSub  = Color(0xFF8FA3BF);
const _textDim  = Color(0xFF4D6480);

const _gold     = Color(0xFFD4A843);
const _goldDim  = Color(0xFFB88C2D);
const _goldGlow = Color(0x26D4A843);

const _teal     = Color(0xFF00C9C8);
const _tealGlow = Color(0x1A00C9C8);

const _emerald  = Color(0xFF10B981);
const _amber    = Color(0xFFF59E0B);
const _rose     = Color(0xFFF43F5E);
const _violet   = Color(0xFF8B5CF6);

// ─── Entry Point ────────────────────────────────────────────────────────────
class GeneralCashierDashboardScreen extends ConsumerWidget {
  const GeneralCashierDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final finance   = ref.watch(financeDataProvider);
    final approvals = ref.watch(pendingApprovalsProvider);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bg,
        body: finance.when(
          loading: () => const _ShimmerLoader(),
          error:   (_, __) => _ErrorView(onRetry: () => ref.invalidate(financeDataProvider)),
          data: (data) => RefreshIndicator(
            color: _gold,
            backgroundColor: _surfaceEl,
            displacement: 70,
            strokeWidth: 2.5,
            onRefresh: () async {
              ref.invalidate(financeDataProvider);
              ref.invalidate(pendingApprovalsProvider);
              await ref.read(financeDataProvider.future);
            },
            child: _DashBody(data: data, approvals: approvals),
          ),
        ),
      ),
    );
  }
}

// ─── Main Body ──────────────────────────────────────────────────────────────
class _DashBody extends StatelessWidget {
  final FinanceDashboardData data;
  final AsyncValue<List<dynamic>> approvals;

  const _DashBody({required this.data, required this.approvals});

  @override
  Widget build(BuildContext context) {
    final currency     = _currencyMark(data.property.currency);
    final approvalCount = approvals.valueOrNull?.length ?? 0;
    final hasAlert =
        data.cashier.pendingHandovers > 0 ||
        data.cashier.pendingDeposits > 0  ||
        data.cashier.sessionsAwaitingReview > 0 ||
        data.cashControl.sessionsWithVariance > 0 ||
        approvalCount > 0;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        _AppHeader(propertyName: data.property.name),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _AlertBanner(clear: !hasAlert, text: hasAlert
                  ? 'Cash actions require your attention today.'
                  : 'Cash position is clear for this business date.'),
              const SizedBox(height: 16),
              _HeroSafeCard(data: data, currency: currency),
              const SizedBox(height: 20),
              _SectionLabel(title: 'TODAY\'S COLLECTIONS',
                  subtitle: 'Where the money is coming from'),
              const SizedBox(height: 10),
              _CollectionsCard(data: data, currency: currency),
              const SizedBox(height: 20),
              _SectionLabel(title: 'CUSTODY PIPELINE',
                  subtitle: 'Every movement from till to safe to bank'),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _KpiCard(
                  label: 'Handovers',
                  value: '${data.cashier.pendingHandovers}',
                  sub: _money(data.cashier.pendingHandoverValue, currency),
                  foot: 'awaiting receipt',
                  icon: Icons.swap_horiz_rounded,
                  color: _amber,
                )),
                const SizedBox(width: 10),
                Expanded(child: _KpiCard(
                  label: 'Bank pipeline',
                  value: '${data.cashier.pendingDeposits}',
                  sub: _money(data.cashier.pendingDepositValue, currency),
                  foot: 'open batches',
                  icon: Icons.account_balance_rounded,
                  color: _teal,
                )),
              ]),
              const SizedBox(height: 10),
              _ReviewQueueCard(data: data),
              const SizedBox(height: 20),
              _SectionLabel(title: 'WORK QUEUE',
                  subtitle: 'Open the detailed workflow when ready to act'),
              const SizedBox(height: 10),
              _WorkQueueButtons(context: context),
            ]),
          ),
        ),
      ],
    );
  }
}

// ─── Sliver App Header ───────────────────────────────────────────────────────
class _AppHeader extends StatelessWidget {
  final String propertyName;
  const _AppHeader({required this.propertyName});

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      floating: false,
      snap: false,
      backgroundColor: _bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      expandedHeight: 80,
      collapsedHeight: 64,
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.pin,
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [_bg, _bg.withValues(alpha: 0)],
            ),
          ),
        ),
        titlePadding: const EdgeInsets.only(left: 20, bottom: 12),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _LivePulse(),
                const SizedBox(width: 6),
                Text('GENERAL CASHIER',
                    style: TextStyle(
                      color: _gold,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.0,
                    )),
              ],
            ),
            const SizedBox(height: 2),
            Text(propertyName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _text,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                )),
          ],
        ),
      ),
      actions: [
        Consumer(builder: (ctx, ref, _) {
          final unread = ref.watch(unreadCountProvider);
          return _IconBtn(
            tooltip: 'Notifications',
            badge: unread,
            icon: Icons.notifications_outlined,
            onTap: () => Navigator.of(ctx)
                .push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
          );
        }),
        _IconBtn(
          tooltip: 'Profile',
          icon: Icons.person_outline_rounded,
          onTap: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
        ),
        const SizedBox(width: 6),
      ],
    );
  }
}

// ─── Animated Live Dot ───────────────────────────────────────────────────────
class _LivePulse extends StatefulWidget {
  @override
  State<_LivePulse> createState() => _LivePulseState();
}

class _LivePulseState extends State<_LivePulse> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
        ..repeat(reverse: true);

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _ctrl,
    builder: (_, __) => Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: _emerald,
        boxShadow: [BoxShadow(
          color: _emerald.withValues(alpha: _ctrl.value * 0.7),
          blurRadius: 6,
          spreadRadius: 1,
        )],
      ),
    ),
  );
}

// ─── Icon Button ─────────────────────────────────────────────────────────────
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
    icon: Stack(clipBehavior: Clip.none, children: [
      Icon(icon, color: _textSub, size: 22),
      if (badge > 0)
        Positioned(
          right: -5, top: -5,
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
              style: const TextStyle(color: Colors.white, fontSize: 7.5, fontWeight: FontWeight.w900),
            ),
          ),
        ),
    ]),
  );
}

// ─── Alert Banner ────────────────────────────────────────────────────────────
class _AlertBanner extends StatelessWidget {
  final bool clear;
  final String text;
  const _AlertBanner({required this.clear, required this.text});

  @override
  Widget build(BuildContext context) {
    final c = clear ? _emerald : _amber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: c.withValues(alpha: .07),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.withValues(alpha: .25)),
      ),
      child: Row(children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: c.withValues(alpha: .12),
            shape: BoxShape.circle,
          ),
          child: Icon(clear ? Icons.shield_rounded : Icons.warning_amber_rounded,
              color: c, size: 16),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(text,
            style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w600))),
        Icon(Icons.chevron_right_rounded, color: c.withValues(alpha: .5), size: 18),
      ]),
    );
  }
}

// ─── Hero Safe Card ──────────────────────────────────────────────────────────
class _HeroSafeCard extends StatelessWidget {
  final FinanceDashboardData data;
  final String currency;
  const _HeroSafeCard({required this.data, required this.currency});

  @override
  Widget build(BuildContext context) {
    final hasVariance = data.cashControl.sessionsWithVariance > 0;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF132742), Color(0xFF0D1E35), Color(0xFF091525)],
          stops: [0, 0.5, 1],
        ),
        border: Border.all(color: _gold.withValues(alpha: .3), width: 1),
        boxShadow: [
          BoxShadow(color: _gold.withValues(alpha: .08), blurRadius: 32, offset: const Offset(0, 12)),
          BoxShadow(color: Colors.black.withValues(alpha: .4), blurRadius: 20, offset: const Offset(0, 8)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(children: [
          // Decorative orb
          Positioned(
            right: -30, top: -30,
            child: Container(
              width: 140, height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  _gold.withValues(alpha: .12),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          Positioned(
            left: -20, bottom: -20,
            child: Container(
              width: 100, height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  _teal.withValues(alpha: .08),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: _goldGlow,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _gold.withValues(alpha: .3)),
                  ),
                  child: const Icon(Icons.lock_rounded, color: _gold, size: 18),
                ),
                const SizedBox(width: 10),
                const Text('GENERAL CASHIER SAFE',
                    style: TextStyle(color: _textSub, fontSize: 10,
                        fontWeight: FontWeight.w700, letterSpacing: 1.4)),
                const Spacer(),
                _SafeStatusBadge(ok: !hasVariance),
              ]),
              const SizedBox(height: 20),
              Text('Safe Balance',
                  style: TextStyle(color: _textDim, fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Text(_money(data.cashier.safeBalance, currency),
                  style: const TextStyle(
                    color: _text,
                    fontSize: 36,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -1.5,
                    height: 1,
                  )),
              const SizedBox(height: 20),
              Container(height: 1, color: _border),
              const SizedBox(height: 16),
              Row(children: [
                _HeroStat(
                  label: 'Open Tills',
                  value: '${data.cashControl.sessions.length}',
                  color: _teal,
                  icon: Icons.point_of_sale_rounded,
                ),
                _VertDivider(),
                _HeroStat(
                  label: 'Variances',
                  value: '${data.cashControl.sessionsWithVariance}',
                  color: hasVariance ? _rose : _emerald,
                  icon: hasVariance ? Icons.warning_amber_rounded : Icons.check_circle_rounded,
                ),
                _VertDivider(),
                _HeroStat(
                  label: 'Collections',
                  value: _money(data.cashier.todayCollections, currency),
                  color: _gold,
                  icon: Icons.savings_rounded,
                  compact: true,
                ),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _SafeStatusBadge extends StatelessWidget {
  final bool ok;
  const _SafeStatusBadge({required this.ok});

  @override
  Widget build(BuildContext context) {
    final c = ok ? _emerald : _rose;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.withValues(alpha: .3)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 5, height: 5,
            decoration: BoxDecoration(shape: BoxShape.circle, color: c)),
        const SizedBox(width: 5),
        Text(ok ? 'BALANCED' : 'VARIANCE',
            style: TextStyle(color: c, fontSize: 8.5, fontWeight: FontWeight.w900, letterSpacing: .8)),
      ]),
    );
  }
}

class _HeroStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  final bool compact;

  const _HeroStat({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, color: color, size: 11),
        const SizedBox(width: 4),
        Flexible(child: Text(label,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: _textDim, fontSize: 9.5, fontWeight: FontWeight.w600))),
      ]),
      const SizedBox(height: 5),
      Text(value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: compact ? 12 : 18,
            fontWeight: FontWeight.w900,
            letterSpacing: compact ? 0 : -0.5,
          )),
    ]),
  );
}

class _VertDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    width: 1, height: 36,
    margin: const EdgeInsets.symmetric(horizontal: 12),
    color: _border,
  );
}

// ─── Collections Card ────────────────────────────────────────────────────────
class _CollectionsCard extends StatelessWidget {
  final FinanceDashboardData data;
  final String currency;
  const _CollectionsCard({required this.data, required this.currency});

  @override
  Widget build(BuildContext context) {
    final methods  = data.cashier.collectionMethods.take(4).toList();
    final outlets  = data.cashier.collectionOutlets.take(4).toList();
    final total    = data.cashier.todayCollections;

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: _tealGlow,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _teal.withValues(alpha: .25))),
              child: const Icon(Icons.insights_rounded, color: _teal, size: 18),
            ),
            const SizedBox(width: 10),
            const Expanded(child: Text('Payment Breakdown',
                style: TextStyle(color: _text, fontSize: 14, fontWeight: FontWeight.w700))),
            Text(_money(total, currency),
                style: const TextStyle(color: _text, fontSize: 15,
                    fontWeight: FontWeight.w900)),
          ]),
        ),
        Container(height: 1, color: _border),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: _CollectionColumn(
              title: 'BY METHOD',
              icon: Icons.credit_card_rounded,
              rows: methods.map((r) =>
                  _CollRow(_fmtLabel(r.method), r.amount, total, currency)).toList(),
              empty: 'No data recorded',
            )),
            Container(width: 1, color: _border, margin: const EdgeInsets.symmetric(horizontal: 14)),
            Expanded(child: _CollectionColumn(
              title: 'BY OUTLET',
              icon: Icons.storefront_rounded,
              rows: outlets.map((r) =>
                  _CollRow(r.outlet, r.amount, total, currency)).toList(),
              empty: 'No outlet activity',
            )),
          ]),
        ),
      ]),
    );
  }

  String _fmtLabel(String v) => v
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .map((p) => p.isEmpty ? p : '${p[0].toUpperCase()}${p.substring(1)}')
      .join(' ');
}

class _CollectionColumn extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<_CollRow> rows;
  final String empty;
  const _CollectionColumn({
    required this.title,
    required this.icon,
    required this.rows,
    required this.empty,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(children: [
        Icon(icon, color: _textDim, size: 12),
        const SizedBox(width: 5),
        Text(title, style: const TextStyle(
            color: _textDim, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: .8)),
      ]),
      const SizedBox(height: 10),
      if (rows.isEmpty)
        Text(empty, style: const TextStyle(color: _textDim, fontSize: 11))
      else
        ...rows,
    ],
  );
}

class _CollRow extends StatelessWidget {
  final String label;
  final double amount;
  final double total;
  final String currency;
  const _CollRow(this.label, this.amount, this.total, this.currency);

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (amount / total).clamp(0.0, 1.0) : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(label,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: _textSub, fontSize: 11, fontWeight: FontWeight.w600))),
          Text(_money(amount, currency),
              style: const TextStyle(color: _text, fontSize: 11, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 3,
            backgroundColor: _border,
            valueColor: const AlwaysStoppedAnimation(_teal),
          ),
        ),
      ]),
    );
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final String foot;
  final IconData icon;
  final Color color;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.sub,
    required this.foot,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _border),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 17),
        ),
        const Spacer(),
        Text(value,
            style: TextStyle(color: color, fontSize: 22,
                fontWeight: FontWeight.w900, letterSpacing: -0.5)),
      ]),
      const SizedBox(height: 14),
      Text(label,
          style: const TextStyle(color: _text, fontSize: 12, fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text(sub,
          maxLines: 1, overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: _textSub, fontSize: 11)),
      const SizedBox(height: 2),
      Text(foot,
          style: TextStyle(color: color.withValues(alpha: .7),
              fontSize: 10, fontWeight: FontWeight.w600)),
    ]),
  );
}

// ─── Review Queue Card ───────────────────────────────────────────────────────
class _ReviewQueueCard extends StatelessWidget {
  final FinanceDashboardData data;
  const _ReviewQueueCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final count = data.cashier.sessionsAwaitingReview;
    final allClear = count == 0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _border),
      ),
      child: Row(children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(
            color: (allClear ? _emerald : _violet).withValues(alpha: .1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(allClear ? Icons.verified_rounded : Icons.rate_review_rounded,
              color: allClear ? _emerald : _violet, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Shift Review Queue',
              style: const TextStyle(color: _text, fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 4),
          Text('$count session${count == 1 ? '' : 's'} awaiting control review',
              style: const TextStyle(color: _textSub, fontSize: 11)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: (allClear ? _emerald : _violet).withValues(alpha: .1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: (allClear ? _emerald : _violet).withValues(alpha: .3)),
          ),
          child: Text(
            allClear ? 'Clear' : '$count pending',
            style: TextStyle(
                color: allClear ? _emerald : _violet,
                fontSize: 10,
                fontWeight: FontWeight.w800),
          ),
        ),
      ]),
    );
  }
}

// ─── Work Queue ───────────────────────────────────────────────────────────────
class _WorkQueueButtons extends StatelessWidget {
  final BuildContext context;
  const _WorkQueueButtons({required this.context});

  @override
  Widget build(BuildContext context) => Column(children: [
    _QueueBtn(
      label: 'Approval Control Centre',
      description: 'Review pending manager approvals',
      icon: Icons.rule_folder_rounded,
      color: _gold,
      onTap: () => Navigator.of(this.context)
          .push(MaterialPageRoute(builder: (_) => const ApprovalsScreen())),
    ),
    const SizedBox(height: 10),
    _QueueBtn(
      label: 'Live Shift Control',
      description: 'Monitor active tills and sessions',
      icon: Icons.point_of_sale_rounded,
      color: _teal,
      onTap: () => Navigator.of(this.context)
          .push(MaterialPageRoute(builder: (_) => const CashierShiftsScreen())),
    ),
  ]);
}

class _QueueBtn extends StatefulWidget {
  final String label;
  final String description;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _QueueBtn({
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  State<_QueueBtn> createState() => _QueueBtnState();
}

class _QueueBtnState extends State<_QueueBtn> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => setState(() => _pressed = true),
    onTapUp: (_) { setState(() => _pressed = false); widget.onTap(); },
    onTapCancel: () => setState(() => _pressed = false),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 120),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: _pressed ? widget.color.withValues(alpha: .08) : _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _pressed
              ? widget.color.withValues(alpha: .5)
              : widget.color.withValues(alpha: .25),
        ),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: widget.color.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(11),
          ),
          child: Icon(widget.icon, color: widget.color, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.label,
              style: TextStyle(color: widget.color, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(widget.description,
              style: const TextStyle(color: _textSub, fontSize: 11)),
        ])),
        Icon(Icons.arrow_forward_ios_rounded, color: widget.color.withValues(alpha: .5), size: 14),
      ]),
    ),
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String title;
  final String subtitle;
  const _SectionLabel({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Container(width: 3, height: 14,
          decoration: BoxDecoration(
            color: _gold,
            borderRadius: BorderRadius.circular(2),
          )),
      const SizedBox(width: 8),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(
            color: _text, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.3)),
        Text(subtitle, style: const TextStyle(color: _textDim, fontSize: 10)),
      ])),
    ],
  );
}

// ─── Shimmer Loader ───────────────────────────────────────────────────────────
class _ShimmerLoader extends StatefulWidget {
  const _ShimmerLoader();

  @override
  State<_ShimmerLoader> createState() => _ShimmerLoaderState();
}

class _ShimmerLoaderState extends State<_ShimmerLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))
        ..repeat();

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _ctrl,
    builder: (_, __) {
      final shimmer = LinearGradient(
        begin: Alignment(-1 + 2 * _ctrl.value - 0.3, 0),
        end: Alignment(-1 + 2 * _ctrl.value + 0.3, 0),
        colors: [_surface, _surfaceEl, _surface],
      );
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 20),
            _shimmerBox(shimmer, 200, 14, radius: 7),
            const SizedBox(height: 8),
            _shimmerBox(shimmer, 300, 22, radius: 11),
            const SizedBox(height: 24),
            _shimmerBox(shimmer, double.infinity, 56, radius: 14),
            const SizedBox(height: 16),
            _shimmerBox(shimmer, double.infinity, 160, radius: 24),
            const SizedBox(height: 16),
            _shimmerBox(shimmer, double.infinity, 140, radius: 20),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: _shimmerBox(shimmer, double.infinity, 110, radius: 18)),
              const SizedBox(width: 10),
              Expanded(child: _shimmerBox(shimmer, double.infinity, 110, radius: 18)),
            ]),
          ]),
        ),
      );
    },
  );

  Widget _shimmerBox(Gradient g, double w, double h, {double radius = 8}) =>
      Container(
        width: w, height: h,
        decoration: BoxDecoration(gradient: g, borderRadius: BorderRadius.circular(radius)),
      );
}

// ─── Error View ───────────────────────────────────────────────────────────────
class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color: _rose.withValues(alpha: .1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.cloud_off_rounded, color: _rose, size: 34),
        ),
        const SizedBox(height: 20),
        const Text('Cash control unavailable',
            style: TextStyle(color: _text, fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        const Text('Check the connection and try again.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _textSub, fontSize: 13)),
        const SizedBox(height: 24),
        SizedBox(
          width: 160,
          child: ElevatedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('Retry'),
            style: ElevatedButton.styleFrom(
              backgroundColor: _goldDim,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
          ),
        ),
      ]),
    ),
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
String _money(double v, String c) =>
    '$c${NumberFormat('#,##0.00').format(v)}';

String _currencyMark(String c) {
  switch (c.toUpperCase()) {
    case 'NGN': return '₦';
    case 'USD': return r'$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    default:    return c.isEmpty ? '₦' : '$c ';
  }
}

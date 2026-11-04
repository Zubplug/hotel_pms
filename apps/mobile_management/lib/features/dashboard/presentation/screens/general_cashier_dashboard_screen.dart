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

const _cashBg = Color(0xFF07111F);
const _cashPanel = Color(0xFF101C30);
const _cashPanelRaised = Color(0xFF162640);
const _cashLine = Color(0xFF263A59);
const _cashText = Color(0xFFF4F7FC);
const _cashMuted = Color(0xFF91A2BB);
const _cashGold = Color(0xFFD8AD52);
const _cashCyan = Color(0xFF55C7E8);
const _cashGreen = Color(0xFF42D392);
const _cashAmber = Color(0xFFF3B35B);
const _cashRed = Color(0xFFF2767B);

class GeneralCashierDashboardScreen extends ConsumerWidget {
  const GeneralCashierDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final finance = ref.watch(financeDataProvider);
    final approvals = ref.watch(pendingApprovalsProvider);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _cashBg,
        body: finance.when(
          loading: () => const _CashierLoading(),
          error: (error, _) =>
              _CashierError(onRetry: () => ref.invalidate(financeDataProvider)),
          data: (data) => RefreshIndicator(
            color: _cashGold,
            backgroundColor: _cashPanelRaised,
            onRefresh: () async {
              ref.invalidate(financeDataProvider);
              ref.invalidate(pendingApprovalsProvider);
              await ref.read(financeDataProvider.future);
            },
            child: _CashierBody(data: data, approvals: approvals),
          ),
        ),
      ),
    );
  }
}

class _CashierBody extends StatelessWidget {
  final FinanceDashboardData data;
  final AsyncValue<List<dynamic>> approvals;

  const _CashierBody({required this.data, required this.approvals});

  @override
  Widget build(BuildContext context) {
    final currency = _currencyMark(data.property.currency);
    final approvalCount = approvals.valueOrNull?.length ?? 0;
    final hasAttention =
        data.cashier.pendingHandovers > 0 ||
        data.cashier.pendingDeposits > 0 ||
        data.cashier.sessionsAwaitingReview > 0 ||
        data.cashControl.sessionsWithVariance > 0 ||
        approvalCount > 0;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverAppBar(
          pinned: true,
          backgroundColor: _cashBg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          titleSpacing: 16,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'GENERAL CASHIER',
                style: TextStyle(
                  color: _cashGold,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.8,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                data.property.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _cashText,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          actions: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: _cashGreen.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: _cashGreen.withValues(alpha: .3)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.circle, color: _cashGreen, size: 7),
                  SizedBox(width: 5),
                  Text(
                    'LIVE',
                    style: TextStyle(
                      color: _cashGreen,
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 2),
            Consumer(
              builder: (context, ref, _) {
                final unread = ref.watch(unreadCountProvider);
                return IconButton(
                  tooltip: 'Notifications',
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const NotificationsScreen(),
                    ),
                  ),
                  icon: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(
                        Icons.notifications_none_rounded,
                        color: _cashText,
                        size: 23,
                      ),
                      if (unread > 0)
                        Positioned(
                          right: -4,
                          top: -5,
                          child: Container(
                            constraints: const BoxConstraints(minWidth: 15),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 3,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: _cashRed,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: _cashBg, width: 1.5),
                            ),
                            child: Text(
                              unread > 99 ? '99+' : '$unread',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
            IconButton(
              tooltip: 'Profile',
              onPressed: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
              icon: const Icon(
                Icons.account_circle_outlined,
                color: _cashText,
                size: 24,
              ),
            ),
            const SizedBox(width: 8),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _StatusBanner(
                clear: !hasAttention,
                text: hasAttention
                    ? 'Cash actions need your attention today.'
                    : 'Cash position is clear for this business date.',
              ),
              const SizedBox(height: 14),
              _SafeCard(data: data, currency: currency),
              const SizedBox(height: 20),
              _CollectionsOverview(data: data, currency: currency),
              const SizedBox(height: 20),
              const _SectionHeading(
                title: 'CUSTODY PIPELINE',
                subtitle: 'Follow every movement from till to safe to bank.',
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      label: 'Handovers',
                      value: '${data.cashier.pendingHandovers}',
                      detail: _money(
                        data.cashier.pendingHandoverValue,
                        currency,
                      ),
                      caption: 'awaiting receipt',
                      icon: Icons.swap_horiz_rounded,
                      color: _cashAmber,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MetricCard(
                      label: 'Bank pipeline',
                      value: '${data.cashier.pendingDeposits}',
                      detail: _money(
                        data.cashier.pendingDepositValue,
                        currency,
                      ),
                      caption: 'open batches',
                      icon: Icons.account_balance_rounded,
                      color: _cashCyan,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _ReviewCard(data: data),
              const SizedBox(height: 20),
              const _SectionHeading(
                title: 'CONTROL QUEUE',
                subtitle:
                    'Resolve exceptions before they become reconciliation issues.',
              ),
              const SizedBox(height: 10),
              _ControlQueue(
                data: data,
                approvalCount: approvalCount,
                currency: currency,
              ),
              const SizedBox(height: 20),
              _QuickLinks(context: context),
            ]),
          ),
        ),
      ],
    );
  }
}

class _CollectionsOverview extends StatelessWidget {
  final FinanceDashboardData data;
  final String currency;

  const _CollectionsOverview({required this.data, required this.currency});

  @override
  Widget build(BuildContext context) {
    final methods = data.cashier.collectionMethods.take(4).toList();
    final outlets = data.cashier.collectionOutlets.take(4).toList();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cashPanel,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _cashLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: _cashGold.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.insights_rounded,
                  color: _cashGold,
                  size: 20,
                ),
              ),
              const SizedBox(width: 11),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TODAY\'S COLLECTIONS',
                      style: TextStyle(
                        color: _cashGold,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.3,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Where the money is coming from',
                      style: TextStyle(
                        color: _cashText,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                _money(data.cashier.todayCollections, currency),
                style: const TextStyle(
                  color: _cashText,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _CollectionColumn(
                  title: 'BY PAYMENT METHOD',
                  icon: Icons.credit_card_rounded,
                  rows: methods
                      .map(
                        (row) => _CollectionRow(
                          _paymentLabel(row.method),
                          row.amount,
                          currency,
                        ),
                      )
                      .toList(),
                  empty: 'No collections recorded',
                ),
              ),
              Container(
                width: 1,
                height: 126,
                color: _cashLine,
                margin: const EdgeInsets.symmetric(horizontal: 13),
              ),
              Expanded(
                child: _CollectionColumn(
                  title: 'BY OUTLET / TILL',
                  icon: Icons.storefront_rounded,
                  rows: outlets
                      .map(
                        (row) =>
                            _CollectionRow(row.outlet, row.amount, currency),
                      )
                      .toList(),
                  empty: 'No outlet activity',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _paymentLabel(String value) => value
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

class _CollectionColumn extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<_CollectionRow> rows;
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
      Row(
        children: [
          Icon(icon, color: _cashMuted, size: 14),
          const SizedBox(width: 5),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: _cashMuted,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: .8,
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: 9),
      if (rows.isEmpty)
        Text(empty, style: const TextStyle(color: _cashMuted, fontSize: 11))
      else
        ...rows,
    ],
  );
}

class _CollectionRow extends StatelessWidget {
  final String label;
  final double amount;
  final String currency;

  const _CollectionRow(this.label, this.amount, this.currency);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 9),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _cashText,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          _money(amount, currency),
          style: const TextStyle(
            color: _cashText,
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _StatusBanner extends StatelessWidget {
  final bool clear;
  final String text;

  const _StatusBanner({required this.clear, required this.text});

  @override
  Widget build(BuildContext context) {
    final color = clear ? _cashGreen : _cashAmber;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: .22)),
      ),
      child: Row(
        children: [
          Icon(
            clear ? Icons.verified_rounded : Icons.priority_high_rounded,
            color: color,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SafeCard extends StatelessWidget {
  final FinanceDashboardData data;
  final String currency;

  const _SafeCard({required this.data, required this.currency});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [_cashPanelRaised, _cashPanel]),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _cashGold.withValues(alpha: .3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .18),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.lock_rounded, color: _cashGold, size: 16),
              SizedBox(width: 8),
              Text(
                'GENERAL CASHIER SAFE',
                style: TextStyle(
                  color: _cashMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _money(data.cashier.safeBalance, currency),
            style: const TextStyle(
              color: _cashText,
              fontSize: 32,
              fontWeight: FontWeight.w900,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Current central custody balance',
            style: TextStyle(color: _cashMuted, fontSize: 12),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _InlineStat(
                label: 'Open tills',
                value: '${data.cashControl.sessions.length}',
                color: _cashCyan,
              ),
              const SizedBox(width: 22),
              _InlineStat(
                label: 'Variances',
                value: '${data.cashControl.sessionsWithVariance}',
                color: data.cashControl.sessionsWithVariance > 0
                    ? _cashRed
                    : _cashGreen,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InlineStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _InlineStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(width: 6),
      Text(label, style: const TextStyle(color: _cashMuted, fontSize: 11)),
    ],
  );
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String detail;
  final String caption;
  final IconData icon;
  final Color color;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.detail,
    required this.caption,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _cashPanel,
      borderRadius: BorderRadius.circular(17),
      border: Border.all(color: _cashLine),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: color, size: 17),
            const Spacer(),
            Text(
              value,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w900,
                fontSize: 19,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          label,
          style: const TextStyle(
            color: _cashText,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          detail,
          style: const TextStyle(color: _cashMuted, fontSize: 11),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        Text(
          caption,
          style: TextStyle(
            color: color.withValues(alpha: .8),
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _ReviewCard extends StatelessWidget {
  final FinanceDashboardData data;

  const _ReviewCard({required this.data});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: _cashPanel,
      borderRadius: BorderRadius.circular(17),
      border: Border.all(color: _cashLine),
    ),
    child: Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: _cashCyan.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(
            Icons.fact_check_rounded,
            color: _cashCyan,
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Shift review queue',
                style: TextStyle(
                  color: _cashText,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '${data.cashier.sessionsAwaitingReview} POS and Front Desk session${data.cashier.sessionsAwaitingReview == 1 ? '' : 's'} awaiting control review',
                style: const TextStyle(color: _cashMuted, fontSize: 11),
              ),
            ],
          ),
        ),
        Icon(
          data.cashier.sessionsAwaitingReview > 0
              ? Icons.arrow_forward_ios_rounded
              : Icons.check_rounded,
          color: data.cashier.sessionsAwaitingReview > 0
              ? _cashCyan
              : _cashGreen,
          size: 16,
        ),
      ],
    ),
  );
}

class _ControlQueue extends StatelessWidget {
  final FinanceDashboardData data;
  final int approvalCount;
  final String currency;

  const _ControlQueue({
    required this.data,
    required this.approvalCount,
    required this.currency,
  });

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[
      _QueueRow(
        icon: Icons.rule_rounded,
        title: 'Approvals',
        detail:
            '$approvalCount request${approvalCount == 1 ? '' : 's'} awaiting decision',
        color: approvalCount > 0 ? _cashAmber : _cashGreen,
      ),
      _QueueRow(
        icon: Icons.compare_arrows_rounded,
        title: 'Cash variances',
        detail: data.cashControl.sessionsWithVariance == 0
            ? 'No open till variance'
            : '${data.cashControl.sessionsWithVariance} session variance · ${_money(data.cashControl.variance.abs(), currency)}',
        color: data.cashControl.sessionsWithVariance > 0
            ? _cashRed
            : _cashGreen,
      ),
      _QueueRow(
        icon: Icons.receipt_long_rounded,
        title: 'Transaction controls',
        detail:
            '${data.transactionControls.refunds.toStringAsFixed(0)} refunds · ${data.transactionControls.overrides} overrides',
        color: _cashCyan,
      ),
    ];
    return Container(
      decoration: BoxDecoration(
        color: _cashPanel,
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: _cashLine),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            rows[i],
            if (i < rows.length - 1) const Divider(height: 1, color: _cashLine),
          ],
        ],
      ),
    );
  }
}

class _QueueRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  final Color color;

  const _QueueRow({
    required this.icon,
    required this.title,
    required this.detail,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(14),
    child: Row(
      children: [
        Icon(icon, color: color, size: 19),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: _cashText,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                detail,
                style: const TextStyle(color: _cashMuted, fontSize: 11),
              ),
            ],
          ),
        ),
        Icon(
          Icons.chevron_right_rounded,
          color: _cashMuted.withValues(alpha: .6),
        ),
      ],
    ),
  );
}

class _QuickLinks extends StatelessWidget {
  final BuildContext context;

  const _QuickLinks({required this.context});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _SectionHeading(
        title: 'WORK QUEUE',
        subtitle: 'Open the detailed workflow when you are ready to act.',
      ),
      const SizedBox(height: 10),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () => Navigator.of(
            this.context,
          ).push(MaterialPageRoute(builder: (_) => const ApprovalsScreen())),
          icon: const Icon(Icons.rule_rounded),
          label: const Text('Open approval control centre'),
          style: OutlinedButton.styleFrom(
            foregroundColor: _cashGold,
            side: BorderSide(color: _cashGold.withValues(alpha: .45)),
            padding: const EdgeInsets.symmetric(vertical: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
      ),
      const SizedBox(height: 10),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () => Navigator.of(this.context).push(
            MaterialPageRoute(builder: (_) => const CashierShiftsScreen()),
          ),
          icon: const Icon(Icons.point_of_sale_rounded),
          label: const Text('Open live shift control'),
          style: OutlinedButton.styleFrom(
            foregroundColor: _cashCyan,
            side: BorderSide(color: _cashCyan.withValues(alpha: .45)),
            padding: const EdgeInsets.symmetric(vertical: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
      ),
    ],
  );
}

class _SectionHeading extends StatelessWidget {
  final String title;
  final String subtitle;

  const _SectionHeading({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(
          color: _cashText,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      ),
      const SizedBox(height: 4),
      Text(subtitle, style: const TextStyle(color: _cashMuted, fontSize: 11)),
    ],
  );
}

class _CashierLoading extends StatelessWidget {
  const _CashierLoading();

  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator(color: _cashGold));
}

class _CashierError extends StatelessWidget {
  final VoidCallback onRetry;

  const _CashierError({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _cashMuted, size: 42),
          const SizedBox(height: 12),
          const Text(
            'Cash control is unavailable',
            style: TextStyle(color: _cashText, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          const Text(
            'Check the connection and try again.',
            style: TextStyle(color: _cashMuted),
          ),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    ),
  );
}

String _money(double value, String currency) =>
    '$currency${NumberFormat('#,##0.00').format(value)}';

String _currencyMark(String currency) {
  switch (currency.toUpperCase()) {
    case 'NGN':
      return '₦';
    case 'USD':
      return r'$';
    case 'GBP':
      return '£';
    case 'EUR':
      return '€';
    default:
      return currency.isEmpty ? '₦' : '$currency ';
  }
}

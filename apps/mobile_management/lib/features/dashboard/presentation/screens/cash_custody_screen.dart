import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../finance/presentation/providers/finance_provider.dart';
import '../../../finance/presentation/models/finance_data.dart';
import '../../data/cash_custody_repository.dart';
import '../../data/cash_deposit_repository.dart';
import 'cashier_shifts_screen.dart';

const _bg = Color(0xFF060E1A);
const _surface = Color(0xFF0D1B2E);
const _surfaceEl = Color(0xFF132338);
const _border = Color(0xFF1E3352);
const _text = Color(0xFFF0F5FF);
const _sub = Color(0xFF8FA3BF);
const _dim = Color(0xFF4D6480);
const _gold = Color(0xFFD4A843);
const _teal = Color(0xFF00C9C8);
const _emerald = Color(0xFF10B981);
const _amber = Color(0xFFF59E0B);
const _rose = Color(0xFFF43F5E);
const _violet = Color(0xFF8B5CF6);

class CashCustodyScreen extends ConsumerStatefulWidget {
  const CashCustodyScreen({super.key});

  @override
  ConsumerState<CashCustodyScreen> createState() => _CashCustodyScreenState();
}

class _CashCustodyScreenState extends ConsumerState<CashCustodyScreen> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(financeDataProvider);
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        foregroundColor: _text,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleSpacing: 20,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'CASH CONTROL',
              style: TextStyle(
                color: _gold,
                fontSize: 9,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
            SizedBox(height: 2),
            Text(
              'Handover & Deposit',
              style: TextStyle(
                color: _text,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
      body: state.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _gold)),
        error: (error, _) => _error(context, ref, error),
        data: (data) {
          final handovers = ref.watch(pendingCashHandoversProvider);
          return RefreshIndicator(
            color: _gold,
            backgroundColor: _surfaceEl,
            onRefresh: () => ref.refresh(financeDataProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              children: [
                _hero(data),
                const SizedBox(height: 16),
                _tabs(data.cashier),
                const SizedBox(height: 16),
                if (_tabIndex == 0) ...[
                  _section(
                    'HANDOVER CONTROL',
                    'Move approved shift cash into General Cashier custody',
                    _violet,
                    Icons.swap_horiz_rounded,
                  ),
                  const SizedBox(height: 10),
                  _handoverSection(context, handovers),
                ] else ...[
                  _section(
                    'DEPOSIT CONTROL',
                    'Track cash staged for banking and reconciliation',
                    _teal,
                    Icons.account_balance_rounded,
                  ),
                  const SizedBox(height: 10),
                  _depositSection(context),
                ],
                const SizedBox(height: 16),
                _readinessCard(data),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _tabs(CashierSnapshot cashier) => Container(
    padding: const EdgeInsets.all(5),
    decoration: BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: _border),
    ),
    child: Row(
      children: [
        _tab(
          'Handovers',
          Icons.swap_horiz_rounded,
          cashier.pendingHandovers,
          _violet,
          0,
        ),
        _tab(
          'Deposits',
          Icons.account_balance_rounded,
          cashier.pendingDeposits,
          _teal,
          1,
        ),
      ],
    ),
  );

  Widget _tab(String label, IconData icon, int count, Color color, int index) {
    final active = _tabIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tabIndex = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: active ? color.withValues(alpha: .13) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: active ? color.withValues(alpha: .45) : Colors.transparent,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: active ? color : _dim, size: 17),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  color: active ? _text : _sub,
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 7),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: active ? color : _surfaceEl,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      color: active ? Colors.white : _sub,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero(FinanceDashboardData data) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(22),
      gradient: const LinearGradient(
        colors: [Color(0xFF182D4B), Color(0xFF0D1B2E), Color(0xFF091525)],
      ),
      border: Border.all(color: _gold.withValues(alpha: .25)),
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
                color: _gold.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(11),
              ),
              child: const Icon(
                Icons.account_balance_wallet_rounded,
                color: _gold,
                size: 19,
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'CUSTODY PIPELINE',
                style: TextStyle(
                  color: _sub,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                ),
              ),
            ),
            Text(
              data.property.currency,
              style: const TextStyle(
                color: _gold,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(
          _money(data.cashier.safeBalance, data.property.currency),
          style: const TextStyle(
            color: _text,
            fontSize: 28,
            fontWeight: FontWeight.w900,
            letterSpacing: -1,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'General Cashier safe balance',
          style: TextStyle(color: _sub, fontSize: 11),
        ),
      ],
    ),
  );

  Widget _handoverCard(BuildContext context, CashierSnapshot cashier) => _Card(
    icon: Icons.compare_arrows_rounded,
    color: _violet,
    title: 'Payment handovers',
    subtitle: cashier.pendingHandovers == 0
        ? 'No approved shifts awaiting custody transfer.'
        : 'Approved shift cash is ready to be transferred.',
    rows: [
      _RowValue('Awaiting receipt', '${cashier.pendingHandovers}', _amber),
      _RowValue(
        'Pending value',
        _money(cashier.pendingHandoverValue, 'NGN'),
        _text,
      ),
    ],
    buttonLabel: 'Review shift control',
    onTap: () => Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const CashierShiftsScreen())),
  );

  Widget _handoverSection(
    BuildContext context,
    AsyncValue<List<PendingCashHandover>> handovers,
  ) => Column(
    children: [
      handovers.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(20),
          child: CircularProgressIndicator(color: _violet, strokeWidth: 2),
        ),
        error: (error, _) =>
            _inlineMessage('Unable to load individual handovers.', _rose),
        data: (items) => items.isEmpty
            ? _inlineMessage('No pending handovers require receipt.', _emerald)
            : Column(
                children: items
                    .map((handover) => _handoverItem(context, handover))
                    .toList(),
              ),
      ),
    ],
  );

  Widget _handoverItem(BuildContext context, PendingCashHandover handover) =>
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(15),
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
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: _amber.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.pending_actions_rounded,
                    color: _amber,
                    size: 17,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        handover.reference,
                        style: const TextStyle(
                          color: _text,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'From ${handover.handedOverBy}',
                        style: const TextStyle(color: _sub, fontSize: 10),
                      ),
                    ],
                  ),
                ),
                Text(
                  _money(handover.amount, 'NGN'),
                  style: const TextStyle(
                    color: _text,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 11),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: handover.sessions
                  .map(
                    (session) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: _surfaceEl,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        session,
                        style: const TextStyle(color: _sub, fontSize: 10),
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 42,
              child: ElevatedButton.icon(
                onPressed: () => _receiveHandover(context, handover),
                icon: const Icon(Icons.check_circle_outline_rounded, size: 17),
                label: const Text('Receive handover'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _emerald,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(11),
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _inlineMessage(String text, Color color) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: color.withValues(alpha: .25)),
    ),
    child: Row(
      children: [
        Icon(Icons.info_outline_rounded, color: color, size: 17),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: const TextStyle(color: _sub, fontSize: 11)),
        ),
      ],
    ),
  );

  Future<void> _receiveHandover(
    BuildContext context,
    PendingCashHandover handover,
  ) async {
    try {
      await ref
          .read(cashCustodyRepositoryProvider)
          .receiveHandover(handover.id);
      ref.invalidate(pendingCashHandoversProvider);
      ref.invalidate(financeDataProvider);
      if (!mounted) return;
      await _showHandoverSuccess(context, handover);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Unable to receive handover: $error')),
        );
    }
  }

  Future<void> _showHandoverSuccess(
    BuildContext context,
    PendingCashHandover handover,
  ) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _SuccessDialog(
        title: 'Handover received',
        reference: handover.reference,
        message:
            'Cash custody has been recorded and the handover is now complete.',
      ),
    );
  }

  Widget _depositCard(CashierSnapshot cashier) => _Card(
    icon: Icons.account_balance_rounded,
    color: _teal,
    title: 'Bank deposits',
    subtitle: cashier.pendingDeposits == 0
        ? 'No open deposit batches awaiting submission.'
        : 'Cash batches require banking follow-up.',
    rows: [
      _RowValue('Open batches', '${cashier.pendingDeposits}', _amber),
      _RowValue(
        'Pending value',
        _money(cashier.pendingDepositValue, 'NGN'),
        _text,
      ),
    ],
    buttonLabel: 'Deposit readiness',
    onTap: null,
  );

  Widget _depositSection(BuildContext context) {
    final deposits = ref.watch(pendingCashDepositsProvider);
    return Column(
      children: [
        deposits.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(20),
            child: CircularProgressIndicator(color: _teal, strokeWidth: 2),
          ),
          error: (_, __) =>
              _inlineMessage('Unable to load individual deposits.', _rose),
          data: (data) => data.deposits.isEmpty
              ? _inlineMessage('No deposits require submission.', _emerald)
              : Column(
                  children: data.deposits
                      .map(
                        (deposit) =>
                            _depositItem(context, deposit, data.bankAccounts),
                      )
                      .toList(),
                ),
        ),
      ],
    );
  }

  Widget _depositItem(
    BuildContext context,
    PendingCashDeposit deposit,
    List<CashBankAccount> accounts,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: _amber.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.account_balance_rounded,
              color: _amber,
              size: 17,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  deposit.reference,
                  style: const TextStyle(
                    color: _text,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${deposit.sessionCount} shift${deposit.sessionCount == 1 ? '' : 's'} · ${accounts.length} bank account${accounts.length == 1 ? '' : 's'} available',
                  style: const TextStyle(color: _sub, fontSize: 10),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _money(deposit.amount, 'NGN'),
                style: const TextStyle(
                  color: _text,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 7),
              SizedBox(
                height: 34,
                child: ElevatedButton(
                  onPressed: accounts.isEmpty
                      ? null
                      : () => _openDepositDialog(context, deposit, accounts),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _teal,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: _surfaceEl,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 11),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9),
                    ),
                  ),
                  child: const Text(
                    'Prepare',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openDepositDialog(
    BuildContext context,
    PendingCashDeposit deposit,
    List<CashBankAccount> accounts,
  ) async {
    String accountId = accounts.first.id;
    final reference = TextEditingController();
    final receipt = TextEditingController();
    var submitting = false;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (_, setDialogState) => Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: _teal.withValues(alpha: .35)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Prepare bank deposit',
                  style: TextStyle(
                    color: _text,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${deposit.reference} · ${_money(deposit.amount, 'NGN')}',
                  style: const TextStyle(
                    color: _teal,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Receiving bank account',
                  style: TextStyle(
                    color: _sub,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: accountId,
                  dropdownColor: _surfaceEl,
                  style: const TextStyle(color: _text, fontSize: 12),
                  decoration: _fieldDecoration(),
                  items: accounts
                      .map(
                        (account) => DropdownMenuItem(
                          value: account.id,
                          child: Text('${account.name} · ${account.bankName}'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => accountId = value ?? accountId),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reference,
                  style: const TextStyle(color: _text, fontSize: 12),
                  decoration: _fieldDecoration(
                    'Bank reference or receipt number',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: receipt,
                  style: const TextStyle(color: _text, fontSize: 12),
                  decoration: _fieldDecoration(
                    'Receipt evidence URL (optional)',
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: submitting
                            ? null
                            : () => Navigator.pop(dialogContext),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: _sub,
                          side: const BorderSide(color: _border),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(11),
                          ),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: submitting
                            ? null
                            : () async {
                                setDialogState(() => submitting = true);
                                try {
                                  await ref
                                      .read(cashDepositRepositoryProvider)
                                      .submit(
                                        deposit.id,
                                        accountId,
                                        bankReference: reference.text.trim(),
                                        receiptUrl: receipt.text.trim(),
                                      );
                                  if (!mounted) return;
                                  Navigator.pop(dialogContext);
                                  ref.invalidate(pendingCashDepositsProvider);
                                  ref.invalidate(financeDataProvider);
                                  await _showDepositSuccess(context, deposit);
                                } catch (error) {
                                  setDialogState(() => submitting = false);
                                  if (mounted)
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          'Unable to submit deposit: $error',
                                        ),
                                      ),
                                    );
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _teal,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(11),
                          ),
                        ),
                        child: Text(
                          submitting ? 'Submitting…' : 'Submit deposit',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    reference.dispose();
    receipt.dispose();
  }

  InputDecoration _fieldDecoration([String? hint]) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: _dim, fontSize: 11),
    filled: true,
    fillColor: _bg,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(11),
      borderSide: const BorderSide(color: _border),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(11),
      borderSide: const BorderSide(color: _border),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(11),
      borderSide: const BorderSide(color: _teal, width: 1.4),
    ),
  );

  Future<void> _showDepositSuccess(
    BuildContext context,
    PendingCashDeposit deposit,
  ) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _SuccessDialog(
        title: 'Deposit submitted',
        reference: deposit.reference,
        message:
            'The deposit was submitted to the bank workflow and recorded for reconciliation.',
      ),
    );
  }

  Widget _readinessCard(FinanceDashboardData data) {
    final variance = data.cashControl.sessionsWithVariance;
    final review = data.cashier.sessionsAwaitingReview;
    final clear = variance == 0 && review == 0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: (clear ? _emerald : _amber).withValues(alpha: .35),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: (clear ? _emerald : _amber).withValues(alpha: .12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              clear ? Icons.verified_rounded : Icons.pending_actions_rounded,
              color: clear ? _emerald : _amber,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  clear
                      ? 'Ready for custody processing'
                      : 'Review required before custody',
                  style: const TextStyle(
                    color: _text,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  clear
                      ? 'No unresolved shift variances or approval reviews.'
                      : '$review shift review${review == 1 ? '' : 's'} · $variance variance${variance == 1 ? '' : 's'}',
                  style: const TextStyle(color: _sub, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(String title, String subtitle, Color color, IconData icon) =>
      Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withValues(alpha: .25)),
            ),
            child: Icon(icon, color: color, size: 17),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: color,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.3,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(color: _sub, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      );

  Widget _error(BuildContext context, WidgetRef ref, Object error) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _rose, size: 34),
          const SizedBox(height: 12),
          const Text(
            'Unable to load cash control',
            style: TextStyle(color: _text, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            '$error',
            textAlign: TextAlign.center,
            style: const TextStyle(color: _sub, fontSize: 11),
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => ref.invalidate(financeDataProvider),
            child: const Text('Retry'),
          ),
        ],
      ),
    ),
  );

  String _money(double value, String currency) => NumberFormat.currency(
    name: currency,
    symbol: currency == 'NGN' ? '₦' : currency,
    decimalDigits: 2,
  ).format(value);
}

class _SuccessDialog extends StatelessWidget {
  final String title;
  final String reference;
  final String message;
  const _SuccessDialog({
    required this.title,
    required this.reference,
    required this.message,
  });

  @override
  Widget build(BuildContext context) => Dialog(
    backgroundColor: Colors.transparent,
    child: Container(
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 20),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _emerald.withValues(alpha: .4)),
        boxShadow: [
          BoxShadow(color: _emerald.withValues(alpha: .15), blurRadius: 30),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: _emerald.withValues(alpha: .12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded, color: _emerald, size: 36),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            style: const TextStyle(
              color: _text,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            reference,
            style: const TextStyle(
              color: _emerald,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: _sub, fontSize: 12, height: 1.45),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: _emerald,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
              ),
              child: const Text(
                'Done',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _Card extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, subtitle, buttonLabel;
  final List<_RowValue> rows;
  final VoidCallback? onTap;
  const _Card({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.rows,
    required this.buttonLabel,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
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
            Icon(icon, color: color, size: 19),
            const SizedBox(width: 9),
            Text(
              title,
              style: const TextStyle(
                color: _text,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),
        Text(
          subtitle,
          style: const TextStyle(color: _sub, fontSize: 11, height: 1.4),
        ),
        const SizedBox(height: 15),
        ...rows.map(
          (row) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    row.label,
                    style: const TextStyle(color: _dim, fontSize: 11),
                  ),
                ),
                Text(
                  row.value,
                  style: TextStyle(
                    color: row.color,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        SizedBox(
          width: double.infinity,
          height: 42,
          child: OutlinedButton.icon(
            onPressed: onTap,
            icon: Icon(
              onTap == null
                  ? Icons.lock_outline_rounded
                  : Icons.arrow_forward_rounded,
              size: 16,
            ),
            label: Text(buttonLabel),
            style: OutlinedButton.styleFrom(
              foregroundColor: color,
              side: BorderSide(color: color.withValues(alpha: .4)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(11),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _RowValue {
  final String label, value;
  final Color color;
  const _RowValue(this.label, this.value, this.color);
}

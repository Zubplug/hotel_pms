import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/cashier_expenses_repository.dart';

const _bg = Color(0xFF07111E);
const _panel = Color(0xFF101D31);
const _raised = Color(0xFF172842);
const _line = Color(0xFF29405F);
const _gold = Color(0xFFD4A843);
const _teal = Color(0xFF55D6BE);
const _text = Color(0xFFF3F7FF);
const _muted = Color(0xFF91A5C2);
const _danger = Color(0xFFF47C86);

class CashierExpensesScreen extends ConsumerStatefulWidget {
  const CashierExpensesScreen({super.key});
  @override
  ConsumerState<CashierExpensesScreen> createState() =>
      _CashierExpensesScreenState();
}

class _CashierExpensesScreenState extends ConsumerState<CashierExpensesScreen> {
  String _filter = 'ALL';

  String _money(double value) =>
      '₦${value.toStringAsFixed(2).replaceAllMapped(RegExp(r'(?<!^)(?=(\d{3})+\.)'), (_) => ',')}';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(cashierExpensesProvider);
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'CASH CONTROL',
              style: TextStyle(
                color: _gold,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.5,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Expenses',
              style: TextStyle(
                color: _text,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => _openCreate(context, null),
            icon: const Icon(Icons.add_circle_outline_rounded, color: _gold),
            tooltip: 'New expense',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: state.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _gold)),
        error: (error, _) => _ErrorState(
          message: error.toString(),
          onRetry: () => ref.invalidate(cashierExpensesProvider),
        ),
        data: (data) => RefreshIndicator(
          color: _gold,
          backgroundColor: _raised,
          onRefresh: () => ref.refresh(cashierExpensesProvider.future),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 30),
            children: [
              _hero(),
              const SizedBox(height: 18),
              _filterBar(),
              const SizedBox(height: 14),
              if (data.expenses.isEmpty)
                const _EmptyState()
              else
                ...data.expenses
                    .where((item) => _filter == 'ALL' || item.status == _filter)
                    .map((item) => _expenseCard(context, data, item)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF172946), Color(0xFF0D1A2D)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _gold.withValues(alpha: .22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _gold.withValues(alpha: .13),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.receipt_long_rounded, color: _gold),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Controlled disbursements',
                      style: TextStyle(
                        color: _text,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Every expense is documented and released through the approval chain.',
                      style: TextStyle(
                        color: _muted,
                        fontSize: 11,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroPill(Icons.verified_user_outlined, 'Approval-first'),
              const SizedBox(width: 8),
              _heroPill(Icons.receipt_long_outlined, 'Audit-ready'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroPill(IconData icon, String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .055),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: Colors.white.withValues(alpha: .08)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: _teal),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            color: _muted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );

  Widget _filterBar() => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        for (final item in const [
          ('ALL', 'All expenses'),
          ('PENDING_APPROVAL', 'Pending'),
          ('APPROVED', 'Ready to pay'),
          ('PAID', 'Paid'),
          ('REJECTED', 'Rejected'),
        ])
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _filter = item.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: _filter == item.$1
                      ? _gold.withValues(alpha: .18)
                      : _panel,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _filter == item.$1
                        ? _gold.withValues(alpha: .7)
                        : _line,
                  ),
                  boxShadow: _filter == item.$1
                      ? [
                          BoxShadow(
                            color: _gold.withValues(alpha: .08),
                            blurRadius: 12,
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  item.$2,
                  style: TextStyle(
                    color: _filter == item.$1 ? _gold : _muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .1,
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );

  Widget _expenseCard(
    BuildContext context,
    CashExpenseData data,
    CashExpense item,
  ) {
    final color = item.status == 'PAID'
        ? _teal
        : item.status == 'APPROVED'
        ? _gold
        : item.status == 'REJECTED'
        ? _danger
        : _muted;
    return Container(
      margin: const EdgeInsets.only(bottom: 11),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line.withValues(alpha: .72)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.reference,
                      style: const TextStyle(
                        color: _text,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      item.payee,
                      style: const TextStyle(color: _muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Text(
                _money(item.amount),
                style: const TextStyle(
                  color: _text,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Row(
            children: [
              Icon(Icons.category_outlined, size: 14, color: color),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${item.category}${item.costCenter == null ? '' : ' · ${item.costCenter}'}',
                  style: const TextStyle(color: _muted, fontSize: 11),
                ),
              ),
              _status(item.status, color),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            item.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: _text, fontSize: 12, height: 1.35),
          ),
          if (item.status == 'APPROVED') ...[
            const SizedBox(height: 13),
            SizedBox(
              width: double.infinity,
              height: 42,
              child: ElevatedButton.icon(
                onPressed: () => _openRelease(context, data, item),
                icon: const Icon(Icons.lock_open_rounded, size: 17),
                label: const Text('Release approved expense'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _gold,
                  foregroundColor: _bg,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _status(String value, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .11),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color.withValues(alpha: .25)),
    ),
    child: Text(
      value.replaceAll('_', ' '),
      style: TextStyle(
        color: color,
        fontSize: 9,
        fontWeight: FontWeight.w800,
        letterSpacing: .3,
      ),
    ),
  );

  Future<void> _openCreate(
    BuildContext context,
    CashExpenseData? existing,
  ) async {
    final data = ref.read(cashierExpensesProvider).valueOrNull;
    if (data == null) return;
    final amount = TextEditingController();
    final payee = TextEditingController();
    final description = TextEditingController();
    final receipt = TextEditingController();
    String categoryId = data.categories.isNotEmpty
        ? data.categories.first.id
        : '';
    String? costCenterId;
    bool saving = false;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (_, setDialog) => Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: const EdgeInsets.all(18),
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
              decoration: BoxDecoration(
                color: _panel,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: _line),
              ),
              child: SingleChildScrollView(
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
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.add_card_rounded,
                            color: _gold,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'New cash expense',
                                style: TextStyle(
                                  color: _text,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              SizedBox(height: 3),
                              Text(
                                'Submit for controlled approval',
                                style: TextStyle(color: _muted, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    _field(
                      'Amount',
                      amount,
                      keyboard: TextInputType.number,
                      prefix: '₦ ',
                    ),
                    const SizedBox(height: 12),
                    _field(
                      'Payee / supplier',
                      payee,
                      hint: 'Who is being paid?',
                    ),
                    const SizedBox(height: 12),
                    _field(
                      'Purpose and description',
                      description,
                      hint: 'Explain what this expense is for',
                      maxLines: 3,
                    ),
                    const SizedBox(height: 12),
                    _select<CashExpenseOption>(
                      label: 'Expense category',
                      value: categoryId,
                      options: data.categories,
                      labelOf: (v) => '${v.name} · ${v.code}',
                      onChanged: (v) =>
                          setDialog(() => categoryId = v ?? categoryId),
                    ),
                    const SizedBox(height: 12),
                    _select<CashExpenseOption>(
                      label: 'Cost centre (optional)',
                      value: costCenterId,
                      options: data.costCenters,
                      labelOf: (v) => '${v.name} · ${v.code}',
                      onChanged: (v) => setDialog(() => costCenterId = v),
                    ),
                    const SizedBox(height: 12),
                    _field(
                      'Receipt evidence URL (optional)',
                      receipt,
                      hint: 'https://…',
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: _gold.withValues(alpha: .07),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            size: 16,
                            color: _gold,
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'No money leaves the safe when you submit. The expense follows the configured approval chain first.',
                              style: TextStyle(
                                color: _muted,
                                fontSize: 11,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: saving
                                ? null
                                : () => Navigator.pop(dialogContext),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: _muted,
                              side: const BorderSide(color: _line),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: saving || data.categories.isEmpty
                                ? null
                                : () async {
                                    final value = double.tryParse(
                                      amount.text.replaceAll(',', '').trim(),
                                    );
                                    if (value == null ||
                                        value <= 0 ||
                                        payee.text.trim().isEmpty ||
                                        description.text.trim().isEmpty ||
                                        categoryId.isEmpty) {
                                      _showMessage(
                                        dialogContext,
                                        'Complete the amount, payee, purpose, and category.',
                                      );
                                      return;
                                    }
                                    setDialog(() => saving = true);
                                    try {
                                      await ref
                                          .read(
                                            cashierExpensesRepositoryProvider,
                                          )
                                          .create(
                                            categoryId: categoryId,
                                            costCenterId: costCenterId,
                                            amount: value,
                                            payee: payee.text.trim(),
                                            description: description.text
                                                .trim(),
                                            receiptUrl:
                                                receipt.text.trim().isEmpty
                                                ? null
                                                : receipt.text.trim(),
                                            items: [],
                                          );
                                      if (!mounted) return;
                                      Navigator.pop(dialogContext);
                                      ref.invalidate(cashierExpensesProvider);
                                      await _success(
                                        context,
                                        'Expense submitted',
                                        'The expense was recorded and sent through the approval workflow.',
                                      );
                                    } catch (error) {
                                      setDialog(() => saving = false);
                                      _showMessage(
                                        dialogContext,
                                        error.toString(),
                                      );
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _gold,
                              foregroundColor: _bg,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: Text(
                              saving ? 'Submitting…' : 'Submit expense',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
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
      },
    );
    amount.dispose();
    payee.dispose();
    description.dispose();
    receipt.dispose();
  }

  Future<void> _openRelease(
    BuildContext context,
    CashExpenseData data,
    CashExpense expense,
  ) async {
    String method = 'CASH';
    String? bankId;
    final reference = TextEditingController();
    bool saving = false;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (_, setDialog) => Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: const EdgeInsets.all(18),
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
              decoration: BoxDecoration(
                color: _panel,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: _line),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Release approved expense',
                    style: TextStyle(
                      color: _text,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '${expense.reference} · ${_money(expense.amount)}',
                    style: const TextStyle(
                      color: _teal,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      _method(
                        'CASH',
                        'Cash safe',
                        method,
                        () => setDialog(() => method = 'CASH'),
                      ),
                      const SizedBox(width: 9),
                      _method(
                        'BANK_TRANSFER',
                        'Bank transfer',
                        method,
                        () => setDialog(() => method = 'BANK_TRANSFER'),
                      ),
                    ],
                  ),
                  if (method == 'BANK_TRANSFER') ...[
                    const SizedBox(height: 14),
                    _select<CashExpenseBankAccount>(
                      label: 'Source bank account',
                      value: bankId,
                      options: data.bankAccounts,
                      labelOf: (v) => '${v.name} · ${v.bankName}',
                      onChanged: (v) => setDialog(() => bankId = v),
                    ),
                    const SizedBox(height: 12),
                    _field(
                      'Transfer reference',
                      reference,
                      hint: 'Bank reference or receipt number',
                    ),
                  ],
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: saving
                              ? null
                              : () => Navigator.pop(dialogContext),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _muted,
                            side: const BorderSide(color: _line),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton(
                          onPressed:
                              saving ||
                                  (method == 'BANK_TRANSFER' &&
                                      (bankId == null ||
                                          reference.text.trim().isEmpty))
                              ? null
                              : () async {
                                  setDialog(() => saving = true);
                                  try {
                                    await ref
                                        .read(cashierExpensesRepositoryProvider)
                                        .release(
                                          expense.id,
                                          method: method,
                                          bankAccountId: bankId,
                                          paymentReference:
                                              reference.text.trim().isEmpty
                                              ? null
                                              : reference.text.trim(),
                                        );
                                    if (!mounted) return;
                                    Navigator.pop(dialogContext);
                                    ref.invalidate(cashierExpensesProvider);
                                    await _success(
                                      context,
                                      'Expense released',
                                      'The payment was posted and the accounting trail was recorded.',
                                    );
                                  } catch (error) {
                                    setDialog(() => saving = false);
                                    _showMessage(
                                      dialogContext,
                                      error.toString(),
                                    );
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _teal,
                            foregroundColor: _bg,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: Text(
                            saving ? 'Posting…' : 'Release and post',
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
        );
      },
    );
    reference.dispose();
  }

  Widget _method(
    String value,
    String label,
    String selected,
    VoidCallback onTap,
  ) {
    final active = selected == value;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(13),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: active ? _teal.withValues(alpha: .1) : _raised,
            borderRadius: BorderRadius.circular(13),
            border: Border.all(
              color: active ? _teal.withValues(alpha: .65) : _line,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                value == 'CASH'
                    ? Icons.payments_outlined
                    : Icons.account_balance_outlined,
                color: active ? _teal : _muted,
                size: 20,
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  color: active ? _teal : _muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String? hint,
    TextInputType? keyboard,
    String? prefix,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: _muted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          maxLines: maxLines,
          style: const TextStyle(color: _text, fontSize: 12),
          decoration: InputDecoration(
            hintText: hint,
            prefixText: prefix,
            hintStyle: const TextStyle(color: Color(0xFF536783), fontSize: 12),
            prefixStyle: const TextStyle(
              color: _gold,
              fontWeight: FontWeight.w800,
            ),
            filled: true,
            fillColor: _raised,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 13,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _gold),
            ),
          ),
        ),
      ],
    );
  }

  Widget _select<T>({
    required String label,
    required String? value,
    required List<T> options,
    required String Function(T) labelOf,
    required ValueChanged<String?> onChanged,
  }) {
    final selected = options.any((item) => '${(item as dynamic).id}' == value)
        ? value
        : null;
    final selectedOption = selected == null
        ? null
        : options.firstWhere((item) => '${(item as dynamic).id}' == selected);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: _muted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: options.isEmpty
              ? null
              : () async {
                  final choice = await showModalBottomSheet<String>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => _PremiumOptionSheet<T>(
                      label: label,
                      options: options,
                      selected: selected,
                      labelOf: labelOf,
                    ),
                  );
                  if (choice != null) onChanged(choice);
                },
          borderRadius: BorderRadius.circular(14),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: _raised,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected == null ? _line : _gold.withValues(alpha: .55),
              ),
              boxShadow: selected == null
                  ? null
                  : [
                      BoxShadow(
                        color: _gold.withValues(alpha: .06),
                        blurRadius: 14,
                      ),
                    ],
            ),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: selected == null
                        ? _muted.withValues(alpha: .08)
                        : _gold.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(
                    Icons.layers_rounded,
                    size: 16,
                    color: selected == null ? _muted : _gold,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    selectedOption == null
                        ? 'Select option'
                        : labelOf(selectedOption),
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: selectedOption == null ? _muted : _text,
                      fontSize: 12,
                      fontWeight: selectedOption == null
                          ? FontWeight.w500
                          : FontWeight.w700,
                    ),
                  ),
                ),
                const Icon(Icons.unfold_more_rounded, color: _muted, size: 19),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _showMessage(BuildContext context, String message) =>
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: _danger),
      );

  Future<void> _success(BuildContext context, String title, String message) {
    return showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: _panel,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        icon: const Icon(Icons.check_circle_rounded, color: _teal, size: 50),
        title: Text(
          title,
          style: const TextStyle(color: _text, fontWeight: FontWeight.w800),
        ),
        content: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: _muted, fontSize: 12, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'Done',
              style: TextStyle(color: _teal, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _PremiumOptionSheet<T> extends StatefulWidget {
  final String label;
  final List<T> options;
  final String? selected;
  final String Function(T) labelOf;

  const _PremiumOptionSheet({
    required this.label,
    required this.options,
    required this.selected,
    required this.labelOf,
  });

  @override
  State<_PremiumOptionSheet<T>> createState() => _PremiumOptionSheetState<T>();
}

class _PremiumOptionSheetState<T> extends State<_PremiumOptionSheet<T>> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filteredOptions = widget.options.where((option) {
      final search = _query.trim().toLowerCase();
      return search.isEmpty ||
          widget.labelOf(option).toLowerCase().contains(search);
    }).toList();
    return SafeArea(
      child: Container(
        constraints: const BoxConstraints(maxHeight: 520),
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 10),
        decoration: BoxDecoration(
          color: _panel,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: _line),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: .35),
              blurRadius: 28,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: _line,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: _gold.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.tune_rounded, color: _gold, size: 19),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Choose ${widget.label}',
                        style: const TextStyle(
                          color: _text,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${widget.options.length} configured options',
                        style: const TextStyle(color: _muted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 15),
            TextField(
              onChanged: (value) => setState(() => _query = value),
              style: const TextStyle(color: _text, fontSize: 12),
              decoration: InputDecoration(
                hintText: 'Search ${widget.label.toLowerCase()}…',
                hintStyle: const TextStyle(color: _muted, fontSize: 12),
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: _muted,
                  size: 19,
                ),
                filled: true,
                fillColor: _raised,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _line),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _line),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _gold),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: filteredOptions.length,
                separatorBuilder: (_, __) => const SizedBox(height: 7),
                itemBuilder: (_, index) {
                  final option = filteredOptions[index];
                  final id = '${(option as dynamic).id}';
                  final active = id == widget.selected;
                  return InkWell(
                    onTap: () => Navigator.pop(context, id),
                    borderRadius: BorderRadius.circular(15),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 13,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: active
                            ? _gold.withValues(alpha: .1)
                            : _raised.withValues(alpha: .6),
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(
                          color: active
                              ? _gold.withValues(alpha: .5)
                              : _line.withValues(alpha: .7),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: active
                                  ? _gold.withValues(alpha: .15)
                                  : _muted.withValues(alpha: .07),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              active
                                  ? Icons.check_rounded
                                  : Icons.chevron_right_rounded,
                              color: active ? _gold : _muted,
                              size: 17,
                            ),
                          ),
                          const SizedBox(width: 11),
                          Expanded(
                            child: Text(
                              widget.labelOf(option),
                              style: TextStyle(
                                color: active ? _text : _muted,
                                fontSize: 12,
                                fontWeight: active
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                              ),
                            ),
                          ),
                          if (active)
                            const Text(
                              'SELECTED',
                              style: TextStyle(
                                color: _gold,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                letterSpacing: .7,
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 60),
    child: const Column(
      children: [
        Icon(Icons.receipt_long_outlined, color: _muted, size: 42),
        SizedBox(height: 14),
        Text(
          'No expenses in this view',
          style: TextStyle(color: _text, fontWeight: FontWeight.w800),
        ),
        SizedBox(height: 6),
        Text(
          'Pull down to refresh or submit a new controlled expense.',
          textAlign: TextAlign.center,
          style: TextStyle(color: _muted, fontSize: 12),
        ),
      ],
    ),
  );
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _muted, size: 42),
          const SizedBox(height: 14),
          const Text(
            'Unable to load expenses',
            style: TextStyle(color: _text, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 7),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: _muted, fontSize: 11),
          ),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}

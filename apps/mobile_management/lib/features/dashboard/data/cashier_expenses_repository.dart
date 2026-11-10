import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class CashExpenseOption {
  final String id, code, name;
  const CashExpenseOption({
    required this.id,
    required this.code,
    required this.name,
  });
  factory CashExpenseOption.fromJson(Map<String, dynamic> json) =>
      CashExpenseOption(
        id: '${json['id'] ?? ''}',
        code: '${json['code'] ?? ''}',
        name: '${json['name'] ?? ''}',
      );
}

class CashExpenseBankAccount {
  final String id, name, bankName, accountNumber;
  final double balance;
  const CashExpenseBankAccount({
    required this.id,
    required this.name,
    required this.bankName,
    required this.accountNumber,
    required this.balance,
  });
  factory CashExpenseBankAccount.fromJson(Map<String, dynamic> json) =>
      CashExpenseBankAccount(
        id: '${json['id'] ?? ''}',
        name: '${json['name'] ?? 'Bank account'}',
        bankName: '${json['bankName'] ?? ''}',
        accountNumber: '${json['accountNumber'] ?? ''}',
        balance: _number(json['balance']),
      );
}

class CashExpenseLine {
  final String description, unit;
  final double quantity, unitPrice, total;
  const CashExpenseLine({
    required this.description,
    required this.unit,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });
  factory CashExpenseLine.fromJson(Map<String, dynamic> json) =>
      CashExpenseLine(
        description: '${json['description'] ?? ''}',
        unit: '${json['unit'] ?? ''}',
        quantity: _number(json['quantity']),
        unitPrice: _number(json['unitPrice']),
        total: _number(json['total']),
      );
}

class CashExpense {
  final String id, reference, status, currency, category, description, payee;
  final String? receiptUrl,
      costCenter,
      currentApprovalStage,
      paymentMethod,
      paymentReference;
  final double amount;
  final DateTime? createdAt;
  final List<CashExpenseLine> lineItems;
  const CashExpense({
    required this.id,
    required this.reference,
    required this.status,
    required this.currency,
    required this.category,
    required this.description,
    required this.payee,
    required this.receiptUrl,
    required this.costCenter,
    required this.currentApprovalStage,
    required this.paymentMethod,
    required this.paymentReference,
    required this.amount,
    required this.createdAt,
    required this.lineItems,
  });
  factory CashExpense.fromJson(Map<String, dynamic> json) => CashExpense(
    id: '${json['id'] ?? ''}',
    reference: '${json['reference'] ?? 'Expense'}',
    status: '${json['status'] ?? 'PENDING_APPROVAL'}',
    currency: '${json['currency'] ?? 'NGN'}',
    category: '${json['category'] ?? 'Uncategorised'}',
    description: '${json['description'] ?? ''}',
    payee: '${json['payee'] ?? ''}',
    receiptUrl: json['receiptUrl']?.toString(),
    costCenter: json['costCenter']?.toString(),
    currentApprovalStage: json['currentApprovalStage']?.toString(),
    paymentMethod: json['paymentMethod']?.toString(),
    paymentReference: json['paymentReference']?.toString(),
    amount: _number(json['amount']),
    createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}'),
    lineItems: (json['lineItems'] as List? ?? [])
        .map(
          (item) =>
              CashExpenseLine.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList(),
  );
}

class CashExpenseData {
  final List<CashExpense> expenses;
  final List<CashExpenseOption> categories, costCenters;
  final List<CashExpenseBankAccount> bankAccounts;
  const CashExpenseData({
    required this.expenses,
    required this.categories,
    required this.costCenters,
    required this.bankAccounts,
  });
  factory CashExpenseData.fromJson(Map<String, dynamic> json) =>
      CashExpenseData(
        expenses: _list(json['expenses'], CashExpense.fromJson),
        categories: _list(json['categories'], CashExpenseOption.fromJson),
        costCenters: _list(json['costCenters'], CashExpenseOption.fromJson),
        bankAccounts: _list(
          json['bankAccounts'],
          CashExpenseBankAccount.fromJson,
        ),
      );
  static List<T> _list<T>(
    dynamic value,
    T Function(Map<String, dynamic>) parse,
  ) => (value is List ? value : const [])
      .map((item) => parse(Map<String, dynamic>.from(item as Map)))
      .toList();
}

double _number(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

class CashierExpensesRepository {
  final Dio _dio;
  CashierExpensesRepository(this._dio);
  Future<CashExpenseData> fetch() async {
    final response = await _dio.get('/mobile/v1/cashier/expenses');
    final data = response.data is Map ? response.data['data'] : null;
    return CashExpenseData.fromJson(
      data is Map ? Map<String, dynamic>.from(data) : {},
    );
  }

  Future<void> create({
    required String categoryId,
    String? costCenterId,
    required double amount,
    required String payee,
    required String description,
    String? receiptUrl,
    required List<Map<String, dynamic>> items,
    String? nightAuditOverrideReason,
  }) async {
    await _dio.post(
      '/mobile/v1/cashier/expenses',
      data: {
        'categoryId': categoryId,
        'costCenterId': costCenterId,
        'amount': amount,
        'currency': 'NGN',
        'payee': payee,
        'description': description,
        'receiptUrl': receiptUrl,
        'items': items,
        'nightAuditOverrideReason': nightAuditOverrideReason,
      },
    );
  }

  Future<void> release(
    String id, {
    required String method,
    String? bankAccountId,
    String? paymentReference,
  }) async {
    await _dio.post(
      '/mobile/v1/cashier/expenses/$id/action',
      data: {
        'action': 'pay',
        'method': method,
        'bankAccountId': bankAccountId,
        'paymentReference': paymentReference,
      },
    );
  }
}

final cashierExpensesRepositoryProvider = Provider(
  (ref) => CashierExpensesRepository(ref.watch(dioProvider)),
);
final cashierExpensesProvider = FutureProvider<CashExpenseData>(
  (ref) => ref.watch(cashierExpensesRepositoryProvider).fetch(),
);

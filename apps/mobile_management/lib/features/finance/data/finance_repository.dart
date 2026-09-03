import '../presentation/models/finance_data.dart';

abstract class FinanceRepository {
  Future<FinanceDashboardData> fetchFinanceData({String period = 'TODAY'});
}

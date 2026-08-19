import '../presentation/models/executive_dashboard_data.dart';

abstract class ExecutiveDashboardRepository {
  Future<ExecutiveDashboardData> fetchDashboardData();
}

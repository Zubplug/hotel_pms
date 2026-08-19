import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_management/core/api/api_client.dart';
import '../presentation/models/notification_data.dart';

abstract class NotificationsRepository {
  Future<NotificationsResponse> getNotifications({String? category, String? cursor, int limit = 30});
  Future<void> markAsRead(String notificationId);
  Future<void> markAllAsRead();
}

class LiveNotificationsRepository implements NotificationsRepository {
  final Ref _ref;

  LiveNotificationsRepository(this._ref);

  @override
  Future<NotificationsResponse> getNotifications({String? category, String? cursor, int limit = 30}) async {
    final dio = _ref.read(dioProvider);
    final Map<String, dynamic> queryParams = {'limit': limit};
    if (category != null) queryParams['category'] = category;
    if (cursor != null) queryParams['cursor'] = cursor;

    final response = await dio.get(
      '/mobile/v1/executive/notifications',
      queryParameters: queryParams,
    );
    
    return NotificationsResponse.fromJson(response.data);
  }

  @override
  Future<void> markAsRead(String notificationId) async {
    final dio = _ref.read(dioProvider);
    await dio.post(
      '/mobile/v1/executive/notifications',
      data: {
        'action': 'mark_read',
        'notificationId': notificationId,
      },
    );
  }

  @override
  Future<void> markAllAsRead() async {
    final dio = _ref.read(dioProvider);
    await dio.post(
      '/mobile/v1/executive/notifications',
      data: {
        'action': 'mark_all_read',
      },
    );
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return LiveNotificationsRepository(ref);
});

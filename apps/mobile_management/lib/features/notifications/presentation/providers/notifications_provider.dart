import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_management/features/notifications/data/notifications_repository.dart';
import '../models/notification_data.dart';

class NotificationsState {
  final List<NotificationData> notifications;
  final bool isLoading;
  final String? error;
  final String? nextCursor;
  final int unreadCount;
  final String selectedCategory;

  NotificationsState({
    required this.notifications,
    this.isLoading = false,
    this.error,
    this.nextCursor,
    this.unreadCount = 0,
    this.selectedCategory = 'All',
  });

  NotificationsState copyWith({
    List<NotificationData>? notifications,
    bool? isLoading,
    String? error,
    String? nextCursor,
    int? unreadCount,
    String? selectedCategory,
    bool clearNextCursor = false,
    bool clearError = false,
  }) {
    return NotificationsState(
      notifications: notifications ?? this.notifications,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      nextCursor: clearNextCursor ? null : (nextCursor ?? this.nextCursor),
      unreadCount: unreadCount ?? this.unreadCount,
      selectedCategory: selectedCategory ?? this.selectedCategory,
    );
  }
}

class NotificationsNotifier extends StateNotifier<NotificationsState> {
  final NotificationsRepository _repository;

  NotificationsNotifier(this._repository) : super(NotificationsState(notifications: [])) {
    loadNotifications();
  }

  Future<void> loadNotifications({bool isRefresh = false}) async {
    if (state.isLoading) return;
    
    if (isRefresh) {
      state = state.copyWith(isLoading: true, clearError: true, clearNextCursor: true, notifications: []);
    } else {
      state = state.copyWith(isLoading: true, clearError: true);
    }

    try {
      final response = await _repository.getNotifications(
        category: state.selectedCategory,
        cursor: state.nextCursor,
      );

      state = state.copyWith(
        isLoading: false,
        notifications: isRefresh ? response.data : [...state.notifications, ...response.data],
        nextCursor: response.nextCursor,
        clearNextCursor: response.nextCursor == null,
        unreadCount: response.unreadCount,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setCategory(String category) {
    if (state.selectedCategory == category) return;
    state = state.copyWith(selectedCategory: category);
    loadNotifications(isRefresh: true);
  }

  Future<void> markAsRead(String id) async {
    // Optimistic update
    final idx = state.notifications.indexWhere((n) => n.id == id);
    if (idx == -1 || state.notifications[idx].isRead) return;

    final updated = List<NotificationData>.from(state.notifications);
    updated[idx] = NotificationData(
      id: updated[idx].id,
      body: updated[idx].body,
      createdAt: updated[idx].createdAt,
      subject: updated[idx].subject,
      priority: updated[idx].priority,
      category: updated[idx].category,
      action: updated[idx].action,
      readAt: DateTime.now().toUtc().toIso8601String(),
    );

    state = state.copyWith(
      notifications: updated,
      unreadCount: (state.unreadCount - 1).clamp(0, 999),
    );

    try {
      await _repository.markAsRead(id);
    } catch (e) {
      // Revert if failed (ignoring for brevity in production it's better to show a snackbar)
    }
  }

  Future<void> markAllAsRead() async {
    final updated = state.notifications.map((n) {
      if (n.isRead) return n;
      return NotificationData(
        id: n.id,
        body: n.body,
        createdAt: n.createdAt,
        subject: n.subject,
        priority: n.priority,
        category: n.category,
        action: n.action,
        readAt: DateTime.now().toUtc().toIso8601String(),
      );
    }).toList();

    state = state.copyWith(notifications: updated, unreadCount: 0);

    try {
      await _repository.markAllAsRead();
    } catch (e) {}
  }
}

final notificationsProvider = StateNotifierProvider<NotificationsNotifier, NotificationsState>((ref) {
  final repo = ref.watch(notificationsRepositoryProvider);
  return NotificationsNotifier(repo);
});

// A separate provider just for the dashboard unread badge
// It listens to the notificationsProvider's unreadCount
final unreadCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider.select((state) => state.unreadCount));
});

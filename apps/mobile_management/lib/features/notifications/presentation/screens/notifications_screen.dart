import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../providers/notifications_provider.dart';
import '../models/notification_data.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      final state = ref.read(notificationsProvider);
      if (state.nextCursor != null && !state.isLoading) {
        ref.read(notificationsProvider.notifier).loadNotifications();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const surfaceNavy = Color(0xFF1E293B);
    const textPrimary = Colors.white;
    const textSecondary = Color(0xFF94A3B8);
    const goldAccent = Color(0xFFD4AF37);

    final state = ref.watch(notificationsProvider);
    final notifier = ref.read(notificationsProvider.notifier);

    return Scaffold(
      backgroundColor: primaryNavy,
      appBar: AppBar(
        backgroundColor: primaryNavy,
        elevation: 0,
        iconTheme: const IconThemeData(color: textPrimary),
        title: const Text(
          'NOTIFICATIONS',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.2, color: textPrimary),
        ),
        actions: [
          if (state.unreadCount > 0)
            TextButton(
              onPressed: () => notifier.markAllAsRead(),
              child: const Text('Mark all as read', style: TextStyle(color: goldAccent)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Tabs
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['All', 'Finance', 'Operations', 'Critical'].map((category) {
                  final isSelected = state.selectedCategory == category;
                  return GestureDetector(
                    onTap: () => notifier.setCategory(category),
                    child: Container(
                      margin: const EdgeInsets.only(right: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? goldAccent.withValues(alpha: 0.15) : surfaceNavy,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? goldAccent : Colors.transparent,
                        ),
                      ),
                      child: Text(
                        category,
                        style: TextStyle(
                          color: isSelected ? goldAccent : textSecondary,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // List
          Expanded(
            child: state.notifications.isEmpty && !state.isLoading
                ? const Center(
                    child: Text(
                      'No notifications found.',
                      style: TextStyle(color: textSecondary),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () => notifier.loadNotifications(isRefresh: true),
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: state.notifications.length + (state.isLoading ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == state.notifications.length) {
                          return const Padding(
                            padding: EdgeInsets.all(16),
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }

                        final notification = state.notifications[index];
                        return _buildNotificationCard(notification, notifier);
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(NotificationData notification, NotificationsNotifier notifier) {
    const surfaceNavy = Color(0xFF1E293B);
    const unreadNavy = Color(0xFF233045);
    const goldAccent = Color(0xFFD4AF37);
    const textPrimary = Colors.white;
    const textSecondary = Color(0xFF94A3B8);

    final isUnread = !notification.isRead;
    final isCritical = notification.isCritical;

    // Critical gets a red indicator whether read or unread
    final indicatorColor = isCritical ? Colors.redAccent : (isUnread ? goldAccent : Colors.transparent);
    final bgColor = isUnread ? unreadNavy : surfaceNavy;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isUnread ? goldAccent.withValues(alpha: 0.2) : Colors.transparent,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            // Future: deep linking logic
            if (notification.action != null) {
              debugPrint('Navigate to: \${notification.action}');
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Indicator
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 6, right: 12),
                  decoration: BoxDecoration(
                    color: indicatorColor,
                    shape: BoxShape.circle,
                  ),
                ),
                
                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (notification.subject != null)
                            Expanded(
                              child: Text(
                                notification.subject!,
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 16,
                                  fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                                ),
                              ),
                            ),
                          Text(
                            timeago.format(DateTime.parse(notification.createdAt)),
                            style: const TextStyle(color: textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        notification.body,
                        style: TextStyle(
                          color: isUnread ? textPrimary : textSecondary,
                          fontSize: 14,
                        ),
                      ),
                      
                      // Explicit Mark as Read button
                      if (isUnread) ...[
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: OutlinedButton(
                            onPressed: () => notifier.markAsRead(notification.id),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: goldAccent,
                              side: const BorderSide(color: goldAccent),
                              minimumSize: const Size(0, 32),
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                            ),
                            child: const Text('Mark as Read', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

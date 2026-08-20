import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../providers/notifications_provider.dart';
import '../models/notification_data.dart';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const _bg            = Color(0xFF08090E);
const _surface       = Color(0xFF111318);
const _surfaceUnread = Color(0xFF14181F);
const _border        = Color(0xFF252A35);
const _gold          = Color(0xFFD4AF37);
const _textPrimary   = Color(0xFFF0F4FF);
const _textSecondary = Color(0xFF8B92A5);
const _textMuted     = Color(0xFF4E5566);
const _red           = Color(0xFFEF4444);
const _orange        = Color(0xFFF97316);
const _blue          = Color(0xFF3B82F6);
const _green         = Color(0xFF22C55E);
const _purple        = Color(0xFF8B5CF6);

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final ScrollController _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    final state = ref.read(notificationsProvider);
    if (_scrollCtrl.position.pixels >=
            _scrollCtrl.position.maxScrollExtent - 200 &&
        state.nextCursor != null &&
        !state.isLoading) {
      ref.read(notificationsProvider.notifier).loadNotifications();
    }
  }

  // ── Category → accent colour ─────────────────────────────────────────────────
  Color _categoryColor(String? category) {
    switch (category?.toLowerCase()) {
      case 'finance':    return _green;
      case 'operations': return _blue;
      case 'critical':   return _red;
      case 'approvals':  return _orange;
      default:           return _textMuted;
    }
  }

  // ── Priority → left-stripe colour ────────────────────────────────────────────
  Color _priorityStripe(NotificationData n) {
    if (n.isCritical)           return _red;
    if (n.priority == 'High')   return _orange;
    if (!n.isRead)              return _gold;
    return Colors.transparent;
  }

  // ── Category icon ─────────────────────────────────────────────────────────────
  IconData _categoryIcon(String? category) {
    switch (category?.toLowerCase()) {
      case 'finance':    return Icons.account_balance_wallet_rounded;
      case 'operations': return Icons.hotel_rounded;
      case 'critical':   return Icons.warning_amber_rounded;
      case 'approvals':  return Icons.approval_rounded;
      default:           return Icons.notifications_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state    = ref.watch(notificationsProvider);
    final notifier = ref.read(notificationsProvider.notifier);

    final criticalCount = state.notifications
        .where((n) => n.isCritical && !n.isRead)
        .length;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────────────────
            _Header(
              unreadCount: state.unreadCount,
              onMarkAll: state.unreadCount > 0
                  ? () => notifier.markAllAsRead()
                  : null,
            ),

            // ── Category Filter ──────────────────────────────────────────────
            _CategoryFilter(
              selected: state.selectedCategory,
              onSelect: (c) => notifier.setCategory(c),
            ),
            const SizedBox(height: 4),

            // ── List ─────────────────────────────────────────────────────────
            Expanded(
              child: _buildList(state, notifier),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(NotificationsState state, NotificationsNotifier notifier) {
    // Initial loading
    if (state.isLoading && state.notifications.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: _gold));
    }

    // Error with no data
    if (state.error != null && state.notifications.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded, color: _textMuted, size: 48),
            const SizedBox(height: 16),
            const Text('Could not load notifications',
                style: TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(state.error!,
                style: const TextStyle(color: _textSecondary, fontSize: 12),
                textAlign: TextAlign.center),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: () => notifier.loadNotifications(isRefresh: true),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: _gold, borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('Retry',
                    style: TextStyle(color: _bg, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      );
    }

    // Empty
    if (state.notifications.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _surface,
                shape: BoxShape.circle,
                border: Border.all(color: _border),
              ),
              child: const Icon(Icons.notifications_off_rounded, color: _textMuted, size: 36),
            ),
            const SizedBox(height: 16),
            const Text('All caught up!',
                style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            const Text('No notifications in this category',
                style: TextStyle(color: _textSecondary, fontSize: 13)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => notifier.loadNotifications(isRefresh: true),
      color: _gold,
      backgroundColor: _surface,
      child: ListView.builder(
        controller: _scrollCtrl,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        itemCount: state.notifications.length + (state.isLoading ? 1 : 0),
        itemBuilder: (ctx, i) {
          // Infinite scroll loader
          if (i == state.notifications.length) {
            return const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator(color: _gold)),
            );
          }

          final n = state.notifications[i];

          // ── Date group header ───────────────────────────────────────────
          final showHeader = i == 0 ||
              !_sameDay(
                DateTime.parse(n.createdAt),
                DateTime.parse(state.notifications[i - 1].createdAt),
              );

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showHeader) _DateHeader(dateStr: n.createdAt),
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _NotificationCard(
                  notification: n,
                  stripeColor: _priorityStripe(n),
                  categoryColor: _categoryColor(n.category),
                  categoryIcon: _categoryIcon(n.category),
                  onTap: () {
                    if (!n.isRead) notifier.markAsRead(n.id);
                  },
                  onMarkRead: n.isRead ? null : () => notifier.markAsRead(n.id),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

// ─── Header ───────────────────────────────────────────────────────────────────
class _Header extends StatelessWidget {
  final int unreadCount;
  final VoidCallback? onMarkAll;
  const _Header({required this.unreadCount, this.onMarkAll});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: BoxDecoration(
        color: _bg,
        border: Border(bottom: BorderSide(color: _border.withOpacity(0.6), width: 0.5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text(
                  'NOTIFICATIONS',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: _textPrimary,
                  ),
                ),
                if (unreadCount > 0) ...[
                  const SizedBox(width: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _red,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$unreadCount',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (onMarkAll != null)
            GestureDetector(
              onTap: onMarkAll,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _gold.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _gold.withOpacity(0.3)),
                ),
                child: const Text(
                  'Mark all read',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _gold,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────
class _SummaryBar extends StatelessWidget {
  final int unread;
  final int critical;
  final int total;
  const _SummaryBar({required this.unread, required this.critical, required this.total});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _border),
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              _SummaryCell(value: unread, label: 'Unread', color: _gold),
              VerticalDivider(color: _border, width: 1, thickness: 1),
              _SummaryCell(value: critical, label: 'Critical', color: _red),
              VerticalDivider(color: _border, width: 1, thickness: 1),
              _SummaryCell(value: total, label: 'Total', color: _textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  final int value;
  final String label;
  final Color color;
  const _SummaryCell({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 10, color: _textMuted, letterSpacing: 0.5)),
          ],
        ),
      ),
    );
  }
}

// ─── Category Filter ──────────────────────────────────────────────────────────
class _CategoryFilter extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelect;
  static const _categories = ['All', 'Finance', 'Operations', 'Critical', 'Approvals'];

  const _CategoryFilter({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: _categories.map((c) {
          final isSelected = c == selected;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onSelect(c),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? _gold.withOpacity(0.12) : _surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? _gold : _border,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Text(
                  c,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? _gold : _textSecondary,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── Date Group Header ────────────────────────────────────────────────────────
class _DateHeader extends StatelessWidget {
  final String dateStr;
  const _DateHeader({required this.dateStr});

  String _label(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(dt.year, dt.month, dt.day);
    if (day == today)                           return 'Today';
    if (day == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return '${dt.day} ${_month(dt.month)} ${dt.year}';
  }

  String _month(int m) =>
      ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];

  @override
  Widget build(BuildContext context) {
    final dt = DateTime.tryParse(dateStr) ?? DateTime.now();
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 10),
      child: Row(
        children: [
          Text(
            _label(dt),
            style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              letterSpacing: 1.2, color: _textMuted,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: Divider(color: _border, height: 1)),
        ],
      ),
    );
  }
}

// ─── Notification Card ────────────────────────────────────────────────────────
class _NotificationCard extends StatelessWidget {
  final NotificationData notification;
  final Color stripeColor;
  final Color categoryColor;
  final IconData categoryIcon;
  final VoidCallback onTap;
  final VoidCallback? onMarkRead;

  const _NotificationCard({
    required this.notification,
    required this.stripeColor,
    required this.categoryColor,
    required this.categoryIcon,
    required this.onTap,
    this.onMarkRead,
  });

  @override
  Widget build(BuildContext context) {
    final isUnread   = !notification.isRead;
    final isCritical = notification.isCritical;
    final n          = notification;

    // Card glow/border colour
    Color borderColor;
    if (isCritical && isUnread)   borderColor = _red.withOpacity(0.35);
    else if (isUnread)            borderColor = _gold.withOpacity(0.25);
    else                         borderColor = _border.withOpacity(0.5);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isUnread ? _surfaceUnread : _surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
          boxShadow: isCritical && isUnread
              ? [BoxShadow(color: _red.withOpacity(0.08), blurRadius: 12, spreadRadius: 1)]
              : null,
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Left stripe ──────────────────────────────────────────────
              Container(
                width: 4,
                color: stripeColor,
              ),

              // ── Body ─────────────────────────────────────────────────────
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top row: subject + priority badge
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              n.subject ?? 'Notification',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: isUnread ? FontWeight.w700 : FontWeight.w600,
                                color: isUnread ? _textPrimary : _textSecondary,
                                height: 1.3,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (isCritical)
                            _PriorityBadge(label: 'CRITICAL', color: _red)
                          else if (n.priority == 'High')
                            _PriorityBadge(label: 'HIGH', color: _orange)
                          else if (isUnread)
                            Container(
                              width: 7, height: 7,
                              margin: const EdgeInsets.only(top: 4),
                              decoration: const BoxDecoration(
                                color: _gold, shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 7),

                      // Body text — supports multi-line (notification engine uses \n)
                      Text(
                        n.body,
                        style: TextStyle(
                          fontSize: 12.5,
                          color: isUnread ? _textSecondary : _textMuted,
                          height: 1.55,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Bottom row: icon + category + time + mark read
                      Row(
                        children: [
                          Icon(categoryIcon, size: 13, color: categoryColor),
                          const SizedBox(width: 5),
                          if (n.category != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: categoryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: categoryColor.withOpacity(0.25)),
                              ),
                              child: Text(
                                n.category!.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: categoryColor,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          const Spacer(),
                          Text(
                            _formatTime(n.createdAt),
                            style: const TextStyle(fontSize: 11, color: _textMuted),
                          ),
                          if (onMarkRead != null) ...[
                            const SizedBox(width: 10),
                            GestureDetector(
                              onTap: onMarkRead,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: _gold.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: _gold.withOpacity(0.3)),
                                ),
                                child: const Text(
                                  'Mark read',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: _gold,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(String createdAt) {
    try {
      return timeago.format(DateTime.parse(createdAt));
    } catch (_) {
      return createdAt;
    }
  }
}

// ─── Priority Badge ───────────────────────────────────────────────────────────
class _PriorityBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _PriorityBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w800,
          color: color,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

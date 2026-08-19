class NotificationData {
  final String id;
  final String? subject;
  final String body;
  final String? priority;
  final String? category;
  final String createdAt;
  final String? readAt;
  final String? action; // deep link

  NotificationData({
    required this.id,
    this.subject,
    required this.body,
    this.priority,
    this.category,
    required this.createdAt,
    this.readAt,
    this.action,
  });

  factory NotificationData.fromJson(Map<String, dynamic> json) {
    return NotificationData(
      id: json['id'] as String,
      subject: json['subject'] as String?,
      body: json['body'] as String,
      priority: json['priority'] as String?,
      category: json['category'] as String?,
      createdAt: json['createdAt'] as String,
      readAt: json['readAt'] as String?,
      action: json['action'] as String?,
    );
  }

  bool get isRead => readAt != null;
  bool get isCritical => priority == 'Critical';
}

class NotificationsResponse {
  final List<NotificationData> data;
  final String? nextCursor;
  final int unreadCount;

  NotificationsResponse({
    required this.data,
    this.nextCursor,
    required this.unreadCount,
  });

  factory NotificationsResponse.fromJson(Map<String, dynamic> json) {
    final meta = json['meta'] as Map<String, dynamic>? ?? {};
    return NotificationsResponse(
      data: (json['data'] as List<dynamic>?)
              ?.map((e) => NotificationData.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      nextCursor: meta['nextCursor'] as String?,
      unreadCount: meta['unreadCount'] as int? ?? 0,
    );
  }
}

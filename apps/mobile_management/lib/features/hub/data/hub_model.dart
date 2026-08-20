class HubData {
  final String generatedAt;
  final HubScope scope;
  final HubSummary summary;
  final List<HubApproval> approvals;
  final List<HubIntervention> interventions;
  final List<HubQuickAction> quickActions;
  final ExecutiveBrief? executiveBrief;

  HubData({
    required this.generatedAt,
    required this.scope,
    required this.summary,
    required this.approvals,
    required this.interventions,
    required this.quickActions,
    this.executiveBrief,
  });

  factory HubData.fromJson(Map<String, dynamic> json) {
    return HubData(
      generatedAt: json['generatedAt'] ?? '',
      scope: HubScope.fromJson(json['scope'] ?? {}),
      summary: HubSummary.fromJson(json['summary'] ?? {}),
      approvals: (json['approvals'] as List<dynamic>?)
              ?.map((e) => HubApproval.fromJson(e))
              .toList() ??
          [],
      interventions: (json['interventions'] as List<dynamic>?)
              ?.map((e) => HubIntervention.fromJson(e))
              .toList() ??
          [],
      quickActions: (json['quickActions'] as List<dynamic>?)
              ?.map((e) => HubQuickAction.fromJson(e))
              .toList() ??
          [],
      executiveBrief: json['executiveBrief'] != null
          ? ExecutiveBrief.fromJson(json['executiveBrief'])
          : null,
    );
  }
}

class HubScope {
  final String property;
  final List<HubProperty> availableProperties;

  HubScope({required this.property, required this.availableProperties});

  factory HubScope.fromJson(Map<String, dynamic> json) {
    return HubScope(
      property: json['property'] ?? '',
      availableProperties: (json['availableProperties'] as List<dynamic>?)
              ?.map((e) => HubProperty.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class HubSummary {
  final int pendingApprovals;
  final int criticalInterventions;

  HubSummary({
    required this.pendingApprovals,
    required this.criticalInterventions,
  });

  factory HubSummary.fromJson(Map<String, dynamic> json) {
    return HubSummary(
      pendingApprovals: json['pendingApprovals'] ?? 0,
      criticalInterventions: json['criticalInterventions'] ?? 0,
    );
  }
}

class HubApproval {
  final String id;
  final String type;
  final double? amount;
  final String? currency;
  final String reason;
  final String status;
  final DateTime createdAt;
  final HubRequester requester;
  final HubProperty property;
  final Map<String, dynamic>? details;

  HubApproval({
    required this.id,
    required this.type,
    this.amount,
    this.currency,
    required this.reason,
    required this.status,
    required this.createdAt,
    required this.requester,
    required this.property,
    this.details,
  });

  factory HubApproval.fromJson(Map<String, dynamic> json) {
    return HubApproval(
      id: json['id'] ?? '',
      type: json['type'] ?? '',
      amount: json['amount'] != null ? (json['amount'] as num).toDouble() : null,
      currency: json['currency'],
      reason: json['reason'] ?? '',
      status: json['status'] ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      requester: HubRequester.fromJson(json['requester'] ?? {}),
      property: HubProperty.fromJson(json['property'] ?? {}),
      details: json['details'],
    );
  }
}

class HubRequester {
  final String name;
  final String department;

  HubRequester({required this.name, required this.department});

  factory HubRequester.fromJson(Map<String, dynamic> json) {
    return HubRequester(
      name: json['name'] ?? 'Unknown',
      department: json['department'] ?? 'Unknown Dept',
    );
  }
}

class HubProperty {
  final String id;
  final String name;
  final String? code;

  HubProperty({required this.id, required this.name, this.code});

  factory HubProperty.fromJson(Map<String, dynamic> json) {
    return HubProperty(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unknown Property',
      code: json['code'],
    );
  }
}

class HubIntervention {
  final String id;
  final String title;
  final String message;
  final String priority;
  final String category;
  final DateTime createdAt;
  final String? actionUrl;
  final Map<String, dynamic>? meta;

  HubIntervention({
    required this.id,
    required this.title,
    required this.message,
    required this.priority,
    required this.category,
    required this.createdAt,
    this.actionUrl,
    this.meta,
  });

  factory HubIntervention.fromJson(Map<String, dynamic> json) {
    return HubIntervention(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      priority: json['priority'] ?? '',
      category: json['category'] ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      actionUrl: json['actionUrl'],
      meta: json['meta'],
    );
  }
}

class HubQuickAction {
  final String id;
  final String label;
  final String icon;
  final String capability;

  HubQuickAction({
    required this.id,
    required this.label,
    required this.icon,
    required this.capability,
  });

  factory HubQuickAction.fromJson(Map<String, dynamic> json) {
    return HubQuickAction(
      id: json['id'] ?? '',
      label: json['label'] ?? '',
      icon: json['icon'] ?? '',
      capability: json['capability'] ?? '',
    );
  }
}

class ExecutiveBrief {
  final String title;
  final String summary;

  ExecutiveBrief({required this.title, required this.summary});

  factory ExecutiveBrief.fromJson(Map<String, dynamic> json) {
    return ExecutiveBrief(
      title: json['title'] ?? '',
      summary: json['summary'] ?? '',
    );
  }
}

class HubData {
  final String generatedAt;
  final HubScope scope;
  final HubAlerts alerts;
  final ApprovalsSummary approvalsSummary;
  final SystemStatus systemStatus;
  final List<HubModule> modules;

  HubData({
    required this.generatedAt,
    required this.scope,
    required this.alerts,
    required this.approvalsSummary,
    required this.systemStatus,
    required this.modules,
  });

  factory HubData.fromJson(Map<String, dynamic> json) {
    return HubData(
      generatedAt: json['generatedAt'] ?? '',
      scope: HubScope.fromJson(json['scope'] ?? {}),
      alerts: HubAlerts.fromJson(json['alerts'] ?? {}),
      approvalsSummary: ApprovalsSummary.fromJson(json['approvalsSummary'] ?? {}),
      systemStatus: SystemStatus.fromJson(json['systemStatus'] ?? {}),
      modules: (json['modules'] as List<dynamic>?)
              ?.map((e) => HubModule.fromJson(e))
              .toList() ??
          [],
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

class HubAlerts {
  final int oooRooms;
  final int cashVariances;
  final int offlineTerminals;

  HubAlerts({
    required this.oooRooms,
    required this.cashVariances,
    required this.offlineTerminals,
  });

  factory HubAlerts.fromJson(Map<String, dynamic> json) {
    return HubAlerts(
      oooRooms: json['oooRooms'] ?? 0,
      cashVariances: json['cashVariances'] ?? 0,
      offlineTerminals: json['offlineTerminals'] ?? 0,
    );
  }
}

class ApprovalsSummary {
  final int totalPending;
  final List<ApprovalTypeCount> byType;

  ApprovalsSummary({
    required this.totalPending,
    required this.byType,
  });

  factory ApprovalsSummary.fromJson(Map<String, dynamic> json) {
    return ApprovalsSummary(
      totalPending: json['totalPending'] ?? 0,
      byType: (json['byType'] as List<dynamic>?)
              ?.map((e) => ApprovalTypeCount.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class ApprovalTypeCount {
  final String type;
  final int count;

  ApprovalTypeCount({required this.type, required this.count});

  factory ApprovalTypeCount.fromJson(Map<String, dynamic> json) {
    return ApprovalTypeCount(
      type: json['type'] ?? '',
      count: json['count'] ?? 0,
    );
  }
}

class SystemStatus {
  final bool cloudConnected;
  final DeviceStatusCounts frontDeskOnline;
  final DeviceStatusCounts posOnline;
  final DateTime? lastSync;
  final DateTime? dataAsOf;

  SystemStatus({
    required this.cloudConnected,
    required this.frontDeskOnline,
    required this.posOnline,
    this.lastSync,
    this.dataAsOf,
  });

  factory SystemStatus.fromJson(Map<String, dynamic> json) {
    return SystemStatus(
      cloudConnected: json['cloudConnected'] ?? false,
      frontDeskOnline: DeviceStatusCounts.fromJson(json['frontDeskOnline'] ?? {}),
      posOnline: DeviceStatusCounts.fromJson(json['posOnline'] ?? {}),
      lastSync: json['lastSync'] != null ? DateTime.tryParse(json['lastSync']) : null,
      dataAsOf: json['dataAsOf'] != null ? DateTime.tryParse(json['dataAsOf']) : null,
    );
  }
}

class DeviceStatusCounts {
  final int online;
  final int total;

  DeviceStatusCounts({required this.online, required this.total});

  factory DeviceStatusCounts.fromJson(Map<String, dynamic> json) {
    return DeviceStatusCounts(
      online: json['online'] ?? 0,
      total: json['total'] ?? 0,
    );
  }
}

class HubModule {
  final String id;
  final String title;
  final String icon;
  final String route;
  final bool enabled;

  HubModule({
    required this.id,
    required this.title,
    required this.icon,
    required this.route,
    required this.enabled,
  });

  factory HubModule.fromJson(Map<String, dynamic> json) {
    return HubModule(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      icon: json['icon'] ?? '',
      route: json['route'] ?? '',
      enabled: json['enabled'] ?? false,
    );
  }
}

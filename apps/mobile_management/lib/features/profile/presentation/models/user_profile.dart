class UserProfileData {
  final UserData user;
  final StaffData? staff;
  final AuthorizationData authorization;
  final PreferencesData preferences;

  UserProfileData({
    required this.user,
    this.staff,
    required this.authorization,
    required this.preferences,
  });

  factory UserProfileData.fromJson(Map<String, dynamic> json) {
    return UserProfileData(
      user: UserData.fromJson(json['user']),
      staff: json['staff'] != null ? StaffData.fromJson(json['staff']) : null,
      authorization: AuthorizationData.fromJson(json['authorization']),
      preferences: PreferencesData.fromJson(json['preferences']),
    );
  }
}

class UserData {
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String? phone;

  UserData({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.phone,
  });

  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      id: json['id'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'],
    );
  }
  
  String get initials {
    if (firstName.isEmpty && lastName.isEmpty) return 'U';
    return '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}';
  }
  
  String get fullName => '$firstName $lastName'.trim();
}

class StaffData {
  final String? employeeId;
  final String position;
  final String department;

  StaffData({
    this.employeeId,
    required this.position,
    required this.department,
  });

  factory StaffData.fromJson(Map<String, dynamic> json) {
    return StaffData(
      employeeId: json['employeeId'],
      position: json['position'] ?? '',
      department: json['department'] ?? '',
    );
  }
}

class AuthorizationData {
  final String role;
  final List<PropertyAccessData> properties;
  final List<String> capabilities;

  AuthorizationData({
    required this.role,
    required this.properties,
    required this.capabilities,
  });

  factory AuthorizationData.fromJson(Map<String, dynamic> json) {
    return AuthorizationData(
      role: json['role'] ?? '',
      properties: (json['properties'] as List<dynamic>?)
              ?.map((e) => PropertyAccessData.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      capabilities: (json['capabilities'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }
}

class PropertyAccessData {
  final String id;
  final String name;
  final String? code;

  PropertyAccessData({
    required this.id,
    required this.name,
    this.code,
  });

  factory PropertyAccessData.fromJson(Map<String, dynamic> json) {
    return PropertyAccessData(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      code: json['code'],
    );
  }
}

class PreferencesData {
  final NotificationPrefsData notifications;
  final bool dailyBrief;
  final bool mfaEnabled;

  PreferencesData({
    required this.notifications,
    required this.dailyBrief,
    required this.mfaEnabled,
  });

  factory PreferencesData.fromJson(Map<String, dynamic> json) {
    return PreferencesData(
      notifications: NotificationPrefsData.fromJson(json['notifications'] ?? {}),
      dailyBrief: json['dailyBrief'] ?? false,
      mfaEnabled: json['mfaEnabled'] ?? false,
    );
  }
}

class NotificationPrefsData {
  final bool criticalAlerts;
  final bool approvals;
  final bool operations;
  final bool guestExperience;

  NotificationPrefsData({
    required this.criticalAlerts,
    required this.approvals,
    required this.operations,
    required this.guestExperience,
  });

  factory NotificationPrefsData.fromJson(Map<String, dynamic> json) {
    return NotificationPrefsData(
      criticalAlerts: json['criticalAlerts'] ?? true,
      approvals: json['approvals'] ?? true,
      operations: json['operations'] ?? true,
      guestExperience: json['guestExperience'] ?? true,
    );
  }
}

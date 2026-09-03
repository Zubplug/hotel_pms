class AuditorDashboardData {
  final String propertyName;
  final DateTime lastUpdatedAt;
  final String businessDate;

  final AuditStatus auditStatus;
  final AuditExceptions auditExceptions;
  final CriticalDiscrepancies criticalDiscrepancies;
  final CashReconciliation cashReconciliation;

  AuditorDashboardData({
    required this.propertyName,
    required this.lastUpdatedAt,
    required this.businessDate,
    required this.auditStatus,
    required this.auditExceptions,
    required this.criticalDiscrepancies,
    required this.cashReconciliation,
  });

  factory AuditorDashboardData.fromJson(Map<String, dynamic> json) {
    return AuditorDashboardData(
      propertyName: json['property']?['name'] ?? 'LodgeCore Property',
      lastUpdatedAt: DateTime.parse(json['generatedAt'] ?? DateTime.now().toIso8601String()),
      businessDate: json['businessDate'] ?? '',
      auditStatus: AuditStatus.fromJson(json['auditStatus'] ?? {}),
      auditExceptions: AuditExceptions.fromJson(json['auditExceptions'] ?? {}),
      criticalDiscrepancies: CriticalDiscrepancies.fromJson(json['criticalDiscrepancies'] ?? {}),
      cashReconciliation: CashReconciliation.fromJson(json['cashReconciliation'] ?? {}),
    );
  }
}

class AuditStatus {
  final String state; // e.g. 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'
  final DateTime? startedAt;
  final DateTime? completedAt;
  final String currentStep;
  final double progressPercent;
  final DateTime? lastSuccessfulAudit;
  final List<String> blockingErrors;

  AuditStatus({
    required this.state,
    this.startedAt,
    this.completedAt,
    required this.currentStep,
    required this.progressPercent,
    this.lastSuccessfulAudit,
    required this.blockingErrors,
  });

  factory AuditStatus.fromJson(Map<String, dynamic> json) {
    return AuditStatus(
      state: json['state'] ?? 'NOT_STARTED',
      startedAt: json['startedAt'] != null ? DateTime.tryParse(json['startedAt']) : null,
      completedAt: json['completedAt'] != null ? DateTime.tryParse(json['completedAt']) : null,
      currentStep: json['currentStep'] ?? '',
      progressPercent: (json['progressPercent'] ?? 0).toDouble(),
      lastSuccessfulAudit: json['lastSuccessfulAudit'] != null ? DateTime.tryParse(json['lastSuccessfulAudit']) : null,
      blockingErrors: (json['blockingErrors'] as List?)?.map((e) => e.toString()).toList() ?? [],
    );
  }
}

class AuditExceptions {
  final int criticalCount;
  final int warningCount;

  AuditExceptions({
    required this.criticalCount,
    required this.warningCount,
  });

  factory AuditExceptions.fromJson(Map<String, dynamic> json) {
    return AuditExceptions(
      criticalCount: json['criticalCount'] ?? 0,
      warningCount: json['warningCount'] ?? 0,
    );
  }
}

class CriticalDiscrepancies {
  final int roomStatusDiscrepancies;
  final int occupancyDiscrepancies;
  final int unpostedCharges;
  final int openFolios;
  final int reservationsRequiringAttention;

  CriticalDiscrepancies({
    required this.roomStatusDiscrepancies,
    required this.occupancyDiscrepancies,
    required this.unpostedCharges,
    required this.openFolios,
    required this.reservationsRequiringAttention,
  });

  factory CriticalDiscrepancies.fromJson(Map<String, dynamic> json) {
    return CriticalDiscrepancies(
      roomStatusDiscrepancies: json['roomStatusDiscrepancies'] ?? 0,
      occupancyDiscrepancies: json['occupancyDiscrepancies'] ?? 0,
      unpostedCharges: json['unpostedCharges'] ?? 0,
      openFolios: json['openFolios'] ?? 0,
      reservationsRequiringAttention: json['reservationsRequiringAttention'] ?? 0,
    );
  }
}

class CashReconciliation {
  final int openShifts;
  final int pendingHandovers;
  final double unreconciledCash;
  final int posSessionsRequiringClosure;
  final int outstandingDeposits;

  CashReconciliation({
    required this.openShifts,
    required this.pendingHandovers,
    required this.unreconciledCash,
    required this.posSessionsRequiringClosure,
    required this.outstandingDeposits,
  });

  factory CashReconciliation.fromJson(Map<String, dynamic> json) {
    return CashReconciliation(
      openShifts: json['openShifts'] ?? 0,
      pendingHandovers: json['pendingHandovers'] ?? 0,
      unreconciledCash: (json['unreconciledCash'] ?? 0).toDouble(),
      posSessionsRequiringClosure: json['posSessionsRequiringClosure'] ?? 0,
      outstandingDeposits: json['outstandingDeposits'] ?? 0,
    );
  }
}

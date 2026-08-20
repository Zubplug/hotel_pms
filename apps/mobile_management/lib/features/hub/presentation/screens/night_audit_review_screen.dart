import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/night_audit_provider.dart';
import '../../data/night_audit_repository.dart';

class NightAuditReviewScreen extends ConsumerStatefulWidget {
  final String propertyId;
  final String propertyName;

  const NightAuditReviewScreen({
    Key? key,
    required this.propertyId,
    required this.propertyName,
  }) : super(key: key);

  @override
  ConsumerState<NightAuditReviewScreen> createState() => _NightAuditReviewScreenState();
}

class _NightAuditReviewScreenState extends ConsumerState<NightAuditReviewScreen> {
  final _dateFormat = DateFormat('dd MMM yyyy');

  @override
  Widget build(BuildContext context) {
    final previewAsync = ref.watch(nightAuditPreviewProvider(widget.propertyId));
    final executionState = ref.watch(nightAuditExecutionProvider);

    ref.listen<AsyncValue<void>>(nightAuditExecutionProvider, (previous, next) {
      next.whenOrNull(
        data: (_) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Night Audit successfully executed.', style: TextStyle(color: Colors.white)),
              backgroundColor: Color(0xFF22C55E),
            ),
          );
          Navigator.of(context).pop(true);
        },
        error: (err, stack) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(err.toString(), style: const TextStyle(color: Colors.white)),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        },
      );
    });

    return Scaffold(
      backgroundColor: const Color(0xFF070D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF070D1A),
        foregroundColor: const Color(0xFFEEF2FF),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        title: const Text(
          'Night Audit',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.2),
        ),
      ),
      body: previewAsync.when(
        data: (preview) => _buildReviewContent(context, preview, executionState.isLoading),
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFD4A853))),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Color(0xFFEF4444)),
                const SizedBox(height: 16),
                Text(
                  err.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFEEF2FF)),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => ref.refresh(nightAuditPreviewProvider(widget.propertyId)),
                  child: const Text('Retry', style: TextStyle(color: Color(0xFFD4A853))),
                )
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildReviewContent(BuildContext context, NightAuditPreview preview, bool isExecuting) {
    if (preview.audit != null && preview.audit!['status'] == 'COMPLETED') {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle_outline, color: Color(0xFF22C55E), size: 64),
              SizedBox(height: 24),
              Text(
                'NIGHT AUDIT COMPLETED',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFEEF2FF),
                  letterSpacing: 2,
                ),
              ),
              SizedBox(height: 12),
              Text(
                'The night audit for this business date has already been run successfully.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14, height: 1.5),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16.0),
            children: [
              _buildHeader(preview),
              const SizedBox(height: 32),
              _buildMetricCard(
                icon: Icons.flight_land_rounded,
                title: 'Pending Arrivals',
                value: preview.pendingArrivals.toString(),
                isWarning: preview.pendingArrivals > 0,
              ),
              const SizedBox(height: 12),
              _buildMetricCard(
                icon: Icons.people_alt_rounded,
                title: 'Projected Stayovers',
                value: preview.projectedStayovers.toString(),
              ),
              const SizedBox(height: 12),
              _buildMetricCard(
                icon: Icons.receipt_long_rounded,
                title: 'Unresolved Folios',
                value: preview.unresolvedFolios.toString(),
                isWarning: preview.unresolvedFolios > 0,
              ),
              const SizedBox(height: 12),
              _buildMetricCard(
                icon: Icons.fact_check_rounded,
                title: 'Open Approvals',
                value: preview.openApprovals.toString(),
                isWarning: preview.openApprovals > 0,
              ),
              if (preview.warnings.isNotEmpty) ...[
                const SizedBox(height: 32),
                const Text(
                  'CRITICAL WARNINGS',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    color: Color(0xFFD4A853),
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFD4A853).withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    children: preview.warnings.map((w) => Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: Color(0xFFD4A853), size: 18),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  w,
                                  style: const TextStyle(color: Color(0xFFEEF2FF), fontSize: 13, height: 1.4),
                                ),
                              ),
                            ],
                          ),
                        )).toList(),
                  ),
                ),
              ]
            ],
          ),
        ),
        _buildBottomActions(context, isExecuting),
      ],
    );
  }

  Widget _buildHeader(NightAuditPreview preview) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF111D33),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E3355)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TARGET PROPERTY',
            style: TextStyle(color: Color(0xFF6B7FA3), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            widget.propertyName,
            style: const TextStyle(color: Color(0xFFEEF2FF), fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'BUSINESS DATE',
                    style: TextStyle(color: Color(0xFF6B7FA3), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _dateFormat.format(preview.businessDate),
                    style: const TextStyle(color: Color(0xFFEEF2FF), fontSize: 15, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'CURRENT TIME',
                    style: TextStyle(color: Color(0xFF6B7FA3), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('HH:mm').format(DateTime.now()),
                    style: const TextStyle(color: Color(0xFFEEF2FF), fontSize: 15, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required IconData icon,
    required String title,
    required String value,
    bool isWarning = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF111D33),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isWarning ? const Color(0xFFEF4444).withValues(alpha: 0.5) : const Color(0xFF1E3355),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isWarning ? const Color(0xFFEF4444).withValues(alpha: 0.1) : const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: isWarning ? const Color(0xFFEF4444) : const Color(0xFF94A3B8), size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(color: Color(0xFFEEF2FF), fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isWarning ? const Color(0xFFEF4444) : const Color(0xFFEEF2FF),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActions(BuildContext context, bool isExecuting) {
    return Container(
      padding: const EdgeInsets.all(24.0),
      decoration: const BoxDecoration(
        color: Color(0xFF070D1A),
        border: Border(top: BorderSide(color: Color(0xFF1E3355))),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: isExecuting ? null : () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFF1E3355)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  foregroundColor: const Color(0xFF94A3B8),
                ),
                child: const Text('Cancel', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: isExecuting
                    ? null
                    : () {
                        ref.read(nightAuditExecutionProvider.notifier).execute(widget.propertyId);
                      },
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFFD4A853),
                  foregroundColor: const Color(0xFF070D1A),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: isExecuting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF070D1A)),
                      )
                    : const Text(
                        'Run Night Audit',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

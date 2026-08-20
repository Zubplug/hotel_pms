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
            const SnackBar(content: Text('Night Audit successfully executed.')),
          );
          Navigator.of(context).pop(true);
        },
        error: (err, stack) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(err.toString()),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        },
      );
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Night Audit'),
      ),
      body: previewAsync.when(
        data: (preview) => _buildReviewContent(context, preview, executionState.isLoading),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 16),
                Text(err.toString(), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.refresh(nightAuditPreviewProvider(widget.propertyId)),
                  child: const Text('Retry'),
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
              Icon(Icons.check_circle, color: Colors.green, size: 64),
              SizedBox(height: 16),
              Text(
                'Night Audit Completed',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text(
                'The night audit for this business date has already been run.',
                textAlign: TextAlign.center,
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
              const SizedBox(height: 24),
              _buildMetricCard(
                icon: Icons.flight_land,
                title: 'Pending Arrivals',
                value: preview.pendingArrivals.toString(),
                isWarning: preview.pendingArrivals > 0,
              ),
              const SizedBox(height: 12),
              _buildMetricCard(
                icon: Icons.people,
                title: 'Projected Stayovers',
                value: preview.projectedStayovers.toString(),
              ),
              const SizedBox(height: 12),
              _buildMetricCard(
                icon: Icons.receipt,
                title: 'Unresolved Folios',
                value: preview.unresolvedFolios.toString(),
                isWarning: preview.unresolvedFolios > 0,
              ),
              const SizedBox(height: 12),
              _buildMetricCard(
                icon: Icons.fact_check,
                title: 'Open Approvals',
                value: preview.openApprovals.toString(),
                isWarning: preview.openApprovals > 0,
              ),
              if (preview.warnings.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Text(
                  'Warnings',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.orange),
                ),
                const SizedBox(height: 8),
                ...preview.warnings.map((w) => Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.warning, color: Colors.orange, size: 20),
                          const SizedBox(width: 8),
                          Expanded(child: Text(w)),
                        ],
                      ),
                    )),
              ]
            ],
          ),
        ),
        _buildBottomActions(context, isExecuting),
      ],
    );
  }

  Widget _buildHeader(NightAuditPreview preview) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Property',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
        ),
        Text(
          widget.propertyName,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Business Date',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
                ),
                Text(
                  _dateFormat.format(preview.businessDate),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Current Time',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
                ),
                Text(
                  DateFormat('HH:mm').format(DateTime.now()),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMetricCard({
    required IconData icon,
    required String title,
    required String value,
    bool isWarning = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isWarning ? Colors.orange.withOpacity(0.5) : Colors.transparent,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, color: isWarning ? Colors.orange : Colors.blueGrey),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 16),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isWarning ? Colors.orange : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActions(BuildContext context, bool isExecuting) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            offset: const Offset(0, -4),
            blurRadius: 8,
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: isExecuting ? null : () => Navigator.of(context).pop(),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text('Cancel'),
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
                backgroundColor: Theme.of(context).colorScheme.error, // Red for high impact
                foregroundColor: Theme.of(context).colorScheme.onError,
              ),
              child: isExecuting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Run Night Audit'),
            ),
          ),
        ],
      ),
    );
  }
}

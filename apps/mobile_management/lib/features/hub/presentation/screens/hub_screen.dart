import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/hub_provider.dart';
import '../widgets/approval_card.dart';
import '../widgets/intervention_card.dart';
import '../widgets/quick_action_button.dart';
import '../widgets/property_filter_dropdown.dart';
import '../../data/hub_model.dart';
import 'approval_review_screen.dart';
import 'night_audit_review_screen.dart';
// ─── Design Tokens ───────────────────────────────────────────────────────────
const _bgDeep = Color(0xFF070D1A);
const _cardBg = Color(0xFF111D33);
const _surfaceNavy = Color(0xFF1E293B);
const _goldLight = Color(0xFFD4A853);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);
const _textMuted = Color(0xFF6B7FA3);
const _red = Color(0xFFEF4444);
const _green = Color(0xFF22C55E);

class HubScreen extends ConsumerWidget {
  const HubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hubState = ref.watch(hubDataProvider);

    return Scaffold(
      backgroundColor: _bgDeep,
      appBar: AppBar(
        backgroundColor: _bgDeep,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('HUB', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _textPrimary, letterSpacing: 1.2)),
            Text('Executive Action Center', style: TextStyle(fontSize: 12, color: _textMuted)),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            alignment: Alignment.centerLeft,
            child: const PropertyFilterDropdown(),
          ),
        ),
      ),
      body: hubState.when(
        loading: () => const Center(child: CircularProgressIndicator(color: _goldLight)),
        error: (err, _) => _buildError(err, ref),
        data: (data) => _buildBody(context, data, ref),
      ),
    );
  }

  Widget _buildError(Object err, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: _red, size: 48),
          const SizedBox(height: 16),
          Text(err.toString(), style: const TextStyle(color: _textPrimary), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => ref.invalidate(hubDataProvider),
            child: const Text('Retry', style: TextStyle(color: _goldLight)),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, HubData data, WidgetRef ref) {
    final hasNoActions = data.approvals.isEmpty && data.interventions.isEmpty;

    return RefreshIndicator(
      color: _goldLight,
      backgroundColor: _surfaceNavy,
      onRefresh: () async => ref.invalidate(hubDataProvider),
      child: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          if (hasNoActions) _buildAllClear(),
          
          if (data.approvals.isNotEmpty) ...[
            _buildSectionHeader('⚡ NEEDS YOUR DECISION', '\${data.summary.pendingApprovals} pending approvals'),
            const SizedBox(height: 12),
            ...data.approvals.map((a) => ApprovalCard(
              approval: a,
              onTap: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (ctx) => ApprovalReviewScreen(approval: a),
                ));
              },
            )),
            _buildViewAllButton('View all approvals'),
            const SizedBox(height: 32),
          ],

          if (data.interventions.isNotEmpty) ...[
            _buildSectionHeader('🚨 EXECUTIVE INTERVENTIONS', '\${data.summary.criticalInterventions} critical alerts'),
            const SizedBox(height: 12),
            ...data.interventions.map((i) => InterventionCard(intervention: i)),
            _buildViewAllButton('View all alerts'),
            const SizedBox(height: 32),
          ],

          if (data.quickActions.isNotEmpty) ...[
            const Text('QUICK ACTIONS', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 2.5,
              children: data.quickActions.map((qa) => QuickActionButton(
                action: qa,
                onTap: () {
                  if (qa.id == 'run_night_audit') {
                    Navigator.push(context, MaterialPageRoute(
                      builder: (ctx) => NightAuditReviewScreen(
                        propertyId: data.scope.property, // Assumes a single property is selected in Hub, or requires one
                        propertyName: data.scope.property == 'ALL_AUTHORIZED' ? 'Selected Properties' : 'Property ${data.scope.property.substring(0, 4)}...',
                      ),
                    ));
                  } else {
                    // Handle other quick actions...
                  }
                },
              )).toList(),
            ),
            const SizedBox(height: 32),
          ],

          if (data.executiveBrief != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF1E3355)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('EXECUTIVE BRIEF', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                  const SizedBox(height: 12),
                  Text(data.executiveBrief!.summary, style: const TextStyle(color: _textPrimary, fontSize: 14, height: 1.5)),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: const [
                      Text('View Brief', style: TextStyle(color: _goldLight, fontWeight: FontWeight.w600)),
                      SizedBox(width: 4),
                      Icon(Icons.arrow_forward_rounded, color: _goldLight, size: 16),
                    ],
                  )
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ],
      ),
    );
  }

  Widget _buildAllClear() {
    return Container(
      margin: const EdgeInsets.only(bottom: 32, top: 16),
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      decoration: BoxDecoration(
        color: _cardBg.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E3355), width: 0.5),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFF1E293B),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_outline, color: _green, size: 48),
          ),
          const SizedBox(height: 24),
          const Text('ALL CLEAR', style: TextStyle(color: _textPrimary, fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 2)),
          const SizedBox(height: 12),
          const Text(
            'No approvals or critical interventions require your attention right now.',
            style: TextStyle(color: _textSecondary, fontSize: 14, height: 1.5),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: _goldLight, fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(color: _textSecondary, fontSize: 13)),
      ],
    );
  }

  Widget _buildViewAllButton(String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 8.0),
      child: Center(
        child: TextButton(
          onPressed: () {},
          child: Text(text, style: const TextStyle(color: _textMuted, fontSize: 13)),
        ),
      ),
    );
  }
}

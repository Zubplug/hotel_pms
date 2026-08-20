import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../data/hub_model.dart';
import '../../providers/hub_provider.dart';

const _bgDeep = Color(0xFF070D1A);
const _cardBg = Color(0xFF111D33);
const _surfaceNavy = Color(0xFF1E293B);
const _goldLight = Color(0xFFD4A853);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);
const _textMuted = Color(0xFF6B7FA3);
const _red = Color(0xFFEF4444);
const _green = Color(0xFF22C55E);

class ApprovalReviewScreen extends ConsumerStatefulWidget {
  final HubApproval approval;

  const ApprovalReviewScreen({super.key, required this.approval});

  @override
  ConsumerState<ApprovalReviewScreen> createState() => _ApprovalReviewScreenState();
}

class _ApprovalReviewScreenState extends ConsumerState<ApprovalReviewScreen> {
  final _commentController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  String _formatAmount(double? amount, String? currency) {
    if (amount == null) return '';
    final curr = currency ?? '₦';
    final formatter = NumberFormat.currency(symbol: curr, decimalDigits: 0);
    return formatter.format(amount);
  }

  Future<void> _handleApprove() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardBg,
        title: const Text('Confirm Approval', style: TextStyle(color: _textPrimary)),
        content: Text('Are you sure you want to approve this \${widget.approval.type.toLowerCase()}?', style: const TextStyle(color: _textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: _textMuted))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Approve', style: TextStyle(color: _green, fontWeight: FontWeight.bold))),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isLoading = true);
      try {
        await ref.read(approvalActionProvider).approve(widget.approval.id);
        if (mounted) Navigator.pop(context);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: _red));
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleReject() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        bool isValid = false;
        return StatefulBuilder(builder: (context, setState) {
          return AlertDialog(
            backgroundColor: _cardBg,
            title: const Text('Reject Request', style: TextStyle(color: _textPrimary)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Please provide a reason for rejection (required):', style: TextStyle(color: _textSecondary, fontSize: 13)),
                const SizedBox(height: 12),
                TextField(
                  controller: _commentController,
                  style: const TextStyle(color: _textPrimary),
                  decoration: InputDecoration(
                    hintText: 'e.g. Please resubmit with original payment reference.',
                    hintStyle: const TextStyle(color: _textMuted),
                    filled: true,
                    fillColor: _surfaceNavy,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                  maxLines: 3,
                  onChanged: (val) => setState(() => isValid = val.trim().isNotEmpty),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: _textMuted))),
              TextButton(
                onPressed: isValid ? () => Navigator.pop(ctx, true) : null,
                child: Text('Reject', style: TextStyle(color: isValid ? _red : _textMuted, fontWeight: FontWeight.bold)),
              ),
            ],
          );
        });
      },
    );

    if (confirmed == true && mounted) {
      setState(() => _isLoading = true);
      try {
        await ref.read(approvalActionProvider).reject(widget.approval.id, _commentController.text.trim());
        if (mounted) Navigator.pop(context);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: _red));
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.approval;
    return Scaffold(
      backgroundColor: _bgDeep,
      appBar: AppBar(
        backgroundColor: _bgDeep,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Approval Review', style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: _goldLight))
          : ListView(
              padding: const EdgeInsets.all(24.0),
              children: [
                Text(app.type, style: const TextStyle(color: _textMuted, fontSize: 14, letterSpacing: 1.5, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(_formatAmount(app.amount, app.currency), style: const TextStyle(color: _textPrimary, fontSize: 32, fontWeight: FontWeight.bold)),
                const SizedBox(height: 32),
                
                _buildSection('Requested by', '\${app.requester.name} · \${app.requester.department}'),
                _buildSection('Property', app.property.name),
                _buildSection('Reason', app.reason),
                
                if (app.details != null && app.details!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text('Supporting Information', style: TextStyle(color: _goldLight, fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF1E3355))),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: app.details!.entries.map((e) => Padding(
                        padding: const EdgeInsets.only(bottom: 8.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(e.key, style: const TextStyle(color: _textSecondary, fontSize: 13)),
                            Text(e.value.toString(), style: const TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      )).toList(),
                    ),
                  ),
                ],
                
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: _surfaceNavy.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12), border: Border.all(color: _goldLight.withValues(alpha: 0.3))),
                  child: Row(
                    children: const [
                      Icon(Icons.info_outline, color: _goldLight, size: 20),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text('Approval authority: You are authorized to approve this request based on your executive role access to this property.', style: TextStyle(color: _textSecondary, fontSize: 12, height: 1.4)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: _isLoading ? null : SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _handleReject,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: _red),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Reject', style: TextStyle(color: _red, fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton(
                  onPressed: _handleApprove,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _green,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Approve', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: _textMuted, fontSize: 13)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

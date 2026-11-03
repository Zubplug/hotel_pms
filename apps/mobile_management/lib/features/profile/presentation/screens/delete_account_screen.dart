import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/profile_repository.dart';

const _deleteBg = Color(0xFF070D1A);
const _deleteCard = Color(0xFF111D33);
const _deleteText = Color(0xFFEEF2FF);
const _deleteSecondary = Color(0xFF94A3B8);
const _deleteRed = Color(0xFFEF4444);

class DeleteAccountScreen extends ConsumerStatefulWidget {
  final String propertyId;
  final String propertyName;
  const DeleteAccountScreen({super.key, required this.propertyId, required this.propertyName});

  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final _reasonController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      final message = await ref.read(profileRepositoryProvider).requestAccountDeletion(propertyId: widget.propertyId, reason: _reasonController.text.trim());
      if (!mounted) return;
      await showDialog<void>(context: context, builder: (_) => AlertDialog(title: const Text('Request submitted'), content: Text('$message\n\nYour account and data remain unchanged while the property manager reviews the request.'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Done'))]));
      if (mounted) Navigator.pop(context);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _deleteBg,
      appBar: AppBar(title: const Text('REQUEST ACCOUNT DELETION'), backgroundColor: _deleteBg, foregroundColor: _deleteText, elevation: 0),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: _deleteCard, borderRadius: BorderRadius.circular(18), border: Border.all(color: _deleteRed.withValues(alpha: .35))), child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(Icons.delete_forever_outlined, color: _deleteRed, size: 30), SizedBox(height: 14), Text('Delete your LodgeCore account', style: TextStyle(color: _deleteText, fontSize: 21, fontWeight: FontWeight.w800)), SizedBox(height: 8), Text('This starts a request to delete your account and associated personal data from LodgeCore Management.', style: TextStyle(color: _deleteSecondary, height: 1.5))])),
        const SizedBox(height: 18),
        Text('Property: ${widget.propertyName}', style: const TextStyle(color: _deleteSecondary, fontSize: 13)),
        const SizedBox(height: 18),
        const Text('Before you request deletion', style: TextStyle(color: _deleteText, fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        const Text('Account deletion may remove your access to the property workspace. Hotel and enterprise records may be controlled by your organisation and may need to be retained for legal, financial, audit, security, or contractual reasons.', style: TextStyle(color: _deleteSecondary, height: 1.6)),
        const SizedBox(height: 18),
        const Text('Reason for request (optional)', style: TextStyle(color: _deleteText, fontSize: 17, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        TextField(controller: _reasonController, maxLines: 4, style: const TextStyle(color: _deleteText), decoration: InputDecoration(hintText: 'Optional context for the property manager', hintStyle: const TextStyle(color: _deleteSecondary), filled: true, fillColor: _deleteCard, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF2B4267))), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF2B4267))))),
        const SizedBox(height: 24),
        FilledButton.icon(onPressed: _saving ? null : _submit, icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send_outlined), label: Text(_saving ? 'SUBMITTING…' : 'SUBMIT FOR MANAGER REVIEW'), style: FilledButton.styleFrom(backgroundColor: _deleteRed, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
        const SizedBox(height: 18),
        const Text('No data is deleted when you submit this request.', textAlign: TextAlign.center, style: TextStyle(color: _deleteSecondary, fontSize: 13)),
      ]),
    );
  }
}

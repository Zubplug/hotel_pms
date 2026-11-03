import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import '../../../authentication/presentation/providers/auth_provider.dart';
import '../../../../core/storage/secure_storage_provider.dart';
import '../../data/profile_repository.dart';
import '../providers/profile_provider.dart';
import '../models/user_profile.dart';
import 'delete_account_screen.dart';

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

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(profileProvider);

    return Scaffold(
      backgroundColor: _bgDeep,
      body: profileState.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _goldLight)),
        error: (err, _) => _buildError(err, ref),
        data: (profile) => _buildBody(context, profile, ref),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    UserProfileData profile,
    WidgetRef ref,
  ) {
    return CustomScrollView(
      slivers: [
        // App Bar
        SliverAppBar(
          pinned: true,
          backgroundColor: _bgDeep,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          flexibleSpace: Container(
            decoration: const BoxDecoration(
              color: _bgDeep,
              border: Border(
                bottom: BorderSide(color: Color(0xFF1E3355), width: 0.5),
              ),
            ),
          ),
          title: const Text(
            'CONTROL CENTER',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.5,
              color: _textPrimary,
            ),
          ),
          centerTitle: false,
          leading: Navigator.canPop(context)
              ? IconButton(
                  icon: const Icon(
                    Icons.arrow_back_ios_new_rounded,
                    color: _textSecondary,
                    size: 20,
                  ),
                  onPressed: () => Navigator.pop(context),
                )
              : null,
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 40),
            child: Column(
              children: [
                // ── Header Profile Card ──────────────────────────────────────
                _SettingsHeroCard(
                  profile: profile,
                  onAccess: () => _showAccessSheet(context, profile),
                ),
                const SizedBox(height: 28),

                // ── Profile Section ────────────────────────────────────────
                _buildSectionTitle('PROFILE'),
                _ProfileInformationCard(profile: profile),
                const SizedBox(height: 24),

                // ── Preferences Section ─────────────────────────────────────
                _buildSectionTitle('PREFERENCES'),
                _buildSettingsGroup([
                  _SettingsTile(
                    title: 'Notifications',
                    icon: Icons.notifications_none_rounded,
                    onTap: () {},
                  ),
                  _SettingsTile(
                    title: 'Biometric Login',
                    icon: Icons.fingerprint_rounded,
                    trailingWidget: const _BiometricSetting(),
                    showChevron: false,
                    onTap: () {},
                  ),
                ]),
                const SizedBox(height: 24),

                // ── Security Section ────────────────────────────────────────
                _buildSectionTitle('SECURITY'),
                _buildSettingsGroup([
                  _SettingsTile(
                    title: 'Change Password',
                    icon: Icons.lock_outline_rounded,
                    onTap: () => _showChangePasswordSheet(context, ref),
                  ),
                  _SettingsTile(
                    title: 'Login PIN',
                    icon: Icons.pin_outlined,
                    value: '6-digit sign in',
                    onTap: () => _showLoginPinSheet(context, ref),
                  ),
                ]),
                const SizedBox(height: 24),

                // ── Support Section ─────────────────────────────────────────
                _buildSectionTitle('SUPPORT'),
                _buildSettingsGroup([
                  _SettingsTile(
                    title: 'Help & Support',
                    icon: Icons.help_outline_rounded,
                    onTap: () {},
                  ),
                  _SettingsTile(
                    title: 'About LodgeCore',
                    icon: Icons.info_outline_rounded,
                    onTap: () {},
                  ),
                  _SettingsTile(
                    title: 'Request account deletion',
                    icon: Icons.delete_outline_rounded,
                    onTap: () {
                      final property = profile.authorization.properties.isNotEmpty ? profile.authorization.properties.first : null;
                      if (property == null) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No property is available for this request.')));
                        return;
                      }
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => DeleteAccountScreen(propertyId: property.id, propertyName: property.name)));
                    },
                  ),
                ]),
                const SizedBox(height: 40),

                // ── Logout Button ───────────────────────────────────────────
                GestureDetector(
                  onTap: () => _showLogoutConfirm(context, ref),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: _red.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _red.withValues(alpha: 0.3)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.logout_rounded, color: _red, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'LOG OUT',
                          style: TextStyle(
                            color: _red,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // Footer
                const Text(
                  'LodgeCore Mobile\\nVersion 1.0.0\\n© 2026 LodgeCore',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _textMuted,
                    fontSize: 11,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildFooterLink('Terms'),
                    const Text('  ·  ', style: TextStyle(color: _textMuted)),
                    _buildFooterLink('Privacy'),
                    const Text('  ·  ', style: TextStyle(color: _textMuted)),
                    _buildFooterLink('Support'),
                  ],
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError(Object err, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, color: _textMuted, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Could not load profile',
            style: TextStyle(
              color: _textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            err.toString(),
            style: const TextStyle(color: _textSecondary, fontSize: 12),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: () => ref.read(profileProvider.notifier).loadProfile(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: _goldLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(color: _bgDeep, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showLogoutConfirm(BuildContext context, WidgetRef ref) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetContext) => Container(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
        decoration: const BoxDecoration(
          color: _cardBg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: Color(0xFF2B4267))),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: _textMuted.withValues(alpha: .45),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: _red.withValues(alpha: .11),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _red.withValues(alpha: .25)),
                    ),
                    child: const Icon(Icons.logout_rounded, color: _red, size: 23),
                  ),
                  const SizedBox(width: 13),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Sign out of LodgeCore?',
                          style: TextStyle(
                            color: _textPrimary,
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Your session will be securely closed on this device.',
                          style: TextStyle(color: _textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: _surfaceNavy.withValues(alpha: .62),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF2B4267)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.verified_user_outlined, color: _goldLight, size: 18),
                    SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        'Saved access credentials and cached account data will remain protected until you sign in again.',
                        style: TextStyle(color: _textSecondary, fontSize: 11, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(sheetContext, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _textSecondary,
                        minimumSize: const Size.fromHeight(48),
                        side: const BorderSide(color: Color(0xFF2B4267)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: const Text('Stay signed in'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => Navigator.pop(sheetContext, true),
                      icon: const Icon(Icons.logout_rounded, size: 17),
                      label: const Text('Sign out'),
                      style: FilledButton.styleFrom(
                        backgroundColor: _red,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        textStyle: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (confirmed == true && context.mounted) {
      await ref.read(authProvider.notifier).logout();
    }
  }

  Future<void> _showChangePasswordSheet(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SecurityFormSheet(
        mode: _SecurityFormMode.password,
        repository: ref.read(profileRepositoryProvider),
      ),
    );
    if (saved == true) {
      await ref.read(tokenStorageProvider).clearBiometricToken();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password updated. Please sign in again.'),
        ),
      );
      await ref.read(authProvider.notifier).logout();
    }
  }

  Future<void> _showLoginPinSheet(BuildContext context, WidgetRef ref) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SecurityFormSheet(
        mode: _SecurityFormMode.pin,
        repository: ref.read(profileRepositoryProvider),
      ),
    );
    if (saved == true) {
      await ref.read(tokenStorageProvider).clearBiometricToken();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Login PIN updated. Please sign in again.'),
        ),
      );
      await ref.read(authProvider.notifier).logout();
    }
  }

  void _showAccessSheet(BuildContext context, UserProfileData profile) {
    showModalBottomSheet(
      context: context,
      backgroundColor: _cardBg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: _textMuted.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Access & Permissions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: _textPrimary,
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'ROLE',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: _textMuted,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _formatRole(profile.authorization.role),
              style: const TextStyle(fontSize: 15, color: _textPrimary),
            ),
            const SizedBox(height: 20),

            const Text(
              'PROPERTIES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: _textMuted,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            ...profile.authorization.properties.map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  p.name,
                  style: const TextStyle(fontSize: 15, color: _textPrimary),
                ),
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'CAPABILITIES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: _textMuted,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            ...profile.authorization.capabilities.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_circle_rounded,
                      color: _green,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        c,
                        style: const TextStyle(
                          fontSize: 14,
                          color: _textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _surfaceNavy,
                  foregroundColor: _textPrimary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text('Close'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Header Card ──────────────────────────────────────────────────────────────

class _SettingsHeroCard extends StatelessWidget {
  final UserProfileData profile;
  final VoidCallback onAccess;

  const _SettingsHeroCard({required this.profile, required this.onAccess});

  @override
  Widget build(BuildContext context) {
    final property = profile.authorization.properties.isNotEmpty
        ? profile.authorization.properties.first.name
        : 'No property assigned';
    return InkWell(
      onTap: onAccess,
      borderRadius: BorderRadius.circular(24),
      child: Ink(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1B3153), Color(0xFF0D1729)],
          ),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _goldLight.withValues(alpha: .30)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: .25),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 62,
              height: 62,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _bgDeep.withValues(alpha: .65),
                border: Border.all(
                  color: _goldLight.withValues(alpha: .65),
                  width: 2,
                ),
              ),
              child: Center(
                child: Text(
                  profile.user.initials.toUpperCase(),
                  style: const TextStyle(
                    color: _goldLight,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profile.user.fullName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _textPrimary,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    profile.staff?.position ??
                        _formatRole(profile.authorization.role),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: _textSecondary, fontSize: 11),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(
                        Icons.shield_rounded,
                        color: _goldLight,
                        size: 13,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          '${_formatRole(profile.authorization.role)} · ${profile.authorization.properties.length} ${profile.authorization.properties.length == 1 ? 'property' : 'properties'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: _goldLight,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  Row(
                    children: [
                      const Icon(
                        Icons.verified_user_rounded,
                        color: _green,
                        size: 13,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          property,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: _green,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: _textMuted,
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Settings Components ──────────────────────────────────────────────────────

class _ProfileInformationCard extends StatelessWidget {
  final UserProfileData profile;

  const _ProfileInformationCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    final phone = profile.user.phone?.trim();
    final department = profile.staff?.department.trim();
    final position = profile.staff?.position.trim();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF1E3355).withValues(alpha: 0.65),
        ),
      ),
      child: Column(
        children: [
          _ProfileInfoRow(
            icon: Icons.person_outline_rounded,
            label: 'Full name',
            value: profile.user.fullName.isEmpty
                ? 'Not provided'
                : profile.user.fullName,
            color: _goldLight,
          ),
          const _ProfileInfoDivider(),
          _ProfileInfoRow(
            icon: Icons.badge_outlined,
            label: 'Position',
            value: position == null || position.isEmpty
                ? _formatRole(profile.authorization.role)
                : position,
            color: const Color(0xFF60A5FA),
          ),
          const _ProfileInfoDivider(),
          _ProfileInfoRow(
            icon: Icons.apartment_rounded,
            label: 'Department',
            value: department == null || department.isEmpty
                ? 'Not assigned'
                : department,
            color: const Color(0xFFC084FC),
          ),
          const _ProfileInfoDivider(),
          _ProfileInfoRow(
            icon: Icons.email_outlined,
            label: 'Email',
            value: profile.user.email.isEmpty
                ? 'Not provided'
                : profile.user.email,
            color: _green,
          ),
          const _ProfileInfoDivider(),
          _ProfileInfoRow(
            icon: Icons.phone_outlined,
            label: 'Phone',
            value: phone == null || phone.isEmpty ? 'Not provided' : phone,
            color: const Color(0xFFF59E0B),
          ),
        ],
      ),
    );
  }
}

class _ProfileInfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _ProfileInfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(11),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: const TextStyle(
                  color: _textMuted,
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProfileInfoDivider extends StatelessWidget {
  const _ProfileInfoDivider();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 11, horizontal: 48),
    child: Divider(height: 1, color: Color(0xFF1E3355)),
  );
}

Widget _buildSectionTitle(String title) {
  return Padding(
    padding: const EdgeInsets.only(left: 4, bottom: 12, top: 8),
    child: Row(
      children: [
        Container(
          width: 4,
          height: 14,
          decoration: BoxDecoration(
            color: _goldLight,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: _textMuted,
            letterSpacing: 1.5,
          ),
        ),
      ],
    ),
  );
}

Widget _buildSettingsGroup(List<Widget> children) {
  return Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: _cardBg.withValues(alpha: 0.7),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFF1E3355).withValues(alpha: 0.6)),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.1),
          blurRadius: 10,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: Column(
      children: children.asMap().entries.map((entry) {
        final int index = entry.key;
        final Widget child = entry.value;
        if (index == children.length - 1) {
          return child;
        }
        return Column(
          children: [
            child,
            Divider(
              color: const Color(0xFF1E3355).withValues(alpha: 0.5),
              height: 1,
              indent: 52,
            ),
          ],
        );
      }).toList(),
    ),
  );
}

class _SettingsTile extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? value;
  final Widget? trailingWidget;
  final bool showChevron;
  final VoidCallback onTap;

  const _SettingsTile({
    required this.title,
    required this.icon,
    this.value,
    this.trailingWidget,
    this.showChevron = true,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          children: [
            Icon(icon, color: _textSecondary, size: 22),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  color: _textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (trailingWidget != null) ...[
              trailingWidget!,
              const SizedBox(width: 4),
            ] else if (value != null) ...[
              Text(
                value!,
                style: const TextStyle(fontSize: 14, color: _textMuted),
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.right,
              ),
              const SizedBox(width: 8),
            ],
            if (showChevron && trailingWidget == null)
              const Icon(
                Icons.chevron_right_rounded,
                color: _textMuted,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}

String _formatRole(String role) {
  final words = role
      .trim()
      .replaceAll('_', ' ')
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .map(
        (word) => '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}',
      )
      .toList();
  return words.isEmpty ? 'Not assigned' : words.join(' ');
}

enum _SecurityFormMode { password, pin }

class _BiometricSetting extends ConsumerStatefulWidget {
  const _BiometricSetting();

  @override
  ConsumerState<_BiometricSetting> createState() => _BiometricSettingState();
}

class _BiometricSettingState extends ConsumerState<_BiometricSetting> {
  final _localAuth = LocalAuthentication();
  bool _available = false;
  bool _enabled = false;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _loadState();
  }

  Future<void> _loadState() async {
    final storage = ref.read(tokenStorageProvider);
    var available = false;
    String? signature;
    try {
      final biometrics = await _localAuth.getAvailableBiometrics();
      available =
          await _localAuth.isDeviceSupported() &&
          await _localAuth.canCheckBiometrics &&
          biometrics.isNotEmpty;
      if (available) signature = _signatureFor(biometrics);
    } catch (_) {}

    final token = await storage.getBiometricToken();
    final savedSignature = await storage.getBiometricSignature();
    final enabled =
        available &&
        token != null &&
        token.isNotEmpty &&
        savedSignature != null &&
        savedSignature == signature;
    if (!enabled && token != null) await storage.clearBiometricToken();
    if (mounted) {
      setState(() {
        _available = available;
        _enabled = enabled;
        _busy = false;
      });
    }
  }

  Future<void> _toggle(bool value) async {
    if (_busy) return;
    final storage = ref.read(tokenStorageProvider);
    if (!value) {
      await storage.clearBiometricToken();
      if (mounted) setState(() => _enabled = false);
      return;
    }

    if (!_available) {
      _showMessage('No enrolled biometric is available on this device.');
      return;
    }
    final token = await storage.getAccessToken();
    if (token == null || token.isEmpty) {
      _showMessage('Sign in again before enabling biometric access.');
      return;
    }

    setState(() => _busy = true);
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason:
            'Confirm your identity to enable LodgeCore biometric sign in',
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
      if (!authenticated) return;
      final signature = _signatureFor(
        await _localAuth.getAvailableBiometrics(),
      );
      await storage.saveBiometricToken(token);
      await storage.saveBiometricSignature(signature);
      if (mounted) setState(() => _enabled = true);
    } on PlatformException catch (error) {
      _showMessage(error.message ?? 'Biometric setup could not be completed.');
    } catch (_) {
      _showMessage('Biometric setup could not be completed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _signatureFor(List<BiometricType> biometrics) {
    final names = biometrics.map((biometric) => biometric.name).toList()
      ..sort();
    return names.join('|');
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Switch.adaptive(
      value: _enabled,
      onChanged: _available && !_busy ? _toggle : null,
      activeThumbColor: _goldLight,
      activeTrackColor: _goldLight.withValues(alpha: 0.3),
      inactiveThumbColor: _textMuted,
      inactiveTrackColor: _surfaceNavy,
    );
  }
}

class _SecurityFormSheet extends StatefulWidget {
  final _SecurityFormMode mode;
  final ProfileRepository repository;

  const _SecurityFormSheet({required this.mode, required this.repository});

  @override
  State<_SecurityFormSheet> createState() => _SecurityFormSheetState();
}

class _SecurityFormSheetState extends State<_SecurityFormSheet> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;
  bool _saving = false;
  String? _error;

  bool get _isPin => widget.mode == _SecurityFormMode.pin;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _currentController.text;
    final next = _newController.text;
    final confirm = _confirmController.text;

    setState(() => _error = null);
    if (current.isEmpty) {
      setState(() => _error = 'Enter your current password to continue.');
      return;
    }
    if (_isPin && !RegExp(r'^\d{6}$').hasMatch(next)) {
      setState(() => _error = 'Your login PIN must contain exactly 6 digits.');
      return;
    }
    if (!_isPin && next.length < 12) {
      setState(
        () => _error = 'Use at least 12 characters for your new password.',
      );
      return;
    }
    if (next != confirm) {
      setState(
        () => _error = _isPin
            ? 'PIN entries do not match.'
            : 'Passwords do not match.',
      );
      return;
    }

    setState(() => _saving = true);
    try {
      if (_isPin) {
        await widget.repository.setLoginPin(
          currentPassword: current,
          pin: next,
        );
      } else {
        await widget.repository.changePassword(
          currentPassword: current,
          newPassword: next,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final title = _isPin ? 'Update login PIN' : 'Change password';
    final subtitle = _isPin
        ? 'Create a secure 6-digit PIN for faster management sign-in.'
        : 'Update your account password. You will need to sign in again afterward.';

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        padding: const EdgeInsets.fromLTRB(22, 12, 22, 24),
        decoration: const BoxDecoration(
          color: _cardBg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: _textMuted.withValues(alpha: .55),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: _goldLight.withValues(alpha: .13),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Icon(
                      _isPin ? Icons.pin_rounded : Icons.lock_rounded,
                      color: _goldLight,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: _textPrimary,
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            color: _textSecondary,
                            fontSize: 11,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _securityField(
                label: 'CURRENT PASSWORD',
                controller: _currentController,
                obscure: !_showCurrent,
                onToggle: () => setState(() => _showCurrent = !_showCurrent),
                keyboardType: TextInputType.visiblePassword,
              ),
              const SizedBox(height: 14),
              _securityField(
                label: _isPin ? 'NEW 6-DIGIT PIN' : 'NEW PASSWORD',
                controller: _newController,
                obscure: !_showNew,
                onToggle: () => setState(() => _showNew = !_showNew),
                keyboardType: _isPin
                    ? TextInputType.number
                    : TextInputType.visiblePassword,
                maxLength: _isPin ? 6 : null,
              ),
              const SizedBox(height: 14),
              _securityField(
                label: _isPin ? 'CONFIRM PIN' : 'CONFIRM PASSWORD',
                controller: _confirmController,
                obscure: !_showConfirm,
                onToggle: () => setState(() => _showConfirm = !_showConfirm),
                keyboardType: _isPin
                    ? TextInputType.number
                    : TextInputType.visiblePassword,
                maxLength: _isPin ? 6 : null,
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _red.withValues(alpha: .10),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _red.withValues(alpha: .25)),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: _red, fontSize: 12),
                  ),
                ),
              ],
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _goldLight,
                    foregroundColor: _bgDeep,
                    disabledBackgroundColor: _goldLight.withValues(alpha: .35),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: _bgDeep,
                          ),
                        )
                      : Text(
                          _isPin ? 'Save login PIN' : 'Update password',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _securityField({
    required String label,
    required TextEditingController controller,
    required bool obscure,
    required VoidCallback onToggle,
    required TextInputType keyboardType,
    int? maxLength,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: _textMuted,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 7),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          maxLength: maxLength,
          autocorrect: false,
          enableSuggestions: false,
          style: const TextStyle(
            color: _textPrimary,
            fontSize: 15,
            letterSpacing: 1.2,
          ),
          decoration: InputDecoration(
            counterText: '',
            filled: true,
            fillColor: _bgDeep.withValues(alpha: .65),
            suffixIcon: IconButton(
              onPressed: onToggle,
              icon: Icon(
                obscure
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                color: _textMuted,
                size: 19,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 14,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: BorderSide(color: _surfaceNavy.withValues(alpha: .8)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: _goldLight, width: 1.2),
            ),
          ),
        ),
      ],
    );
  }
}

Widget _buildFooterLink(String label) {
  return GestureDetector(
    onTap: () {},
    child: Text(
      label,
      style: const TextStyle(
        fontSize: 11,
        color: _textMuted,
        decoration: TextDecoration.underline,
      ),
    ),
  );
}

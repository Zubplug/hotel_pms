import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../authentication/presentation/providers/auth_provider.dart';
import '../providers/profile_provider.dart';
import '../models/user_profile.dart';


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
        loading: () => const Center(
          child: CircularProgressIndicator(color: _goldLight),
        ),
        error: (err, _) => _buildError(err, ref),
        data: (profile) => _buildBody(context, profile, ref),
      ),
    );
  }

  Widget _buildBody(BuildContext context, UserProfileData profile, WidgetRef ref) {
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
              border: Border(bottom: BorderSide(color: Color(0xFF1E3355), width: 0.5)),
            ),
          ),
          title: const Text(
            'YOU',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.5,
              color: _textPrimary,
            ),
          ),
          centerTitle: true,
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 40),
            child: Column(
              children: [
                // ── Header Profile Card ──────────────────────────────────────
                _ProfileHeaderCard(profile: profile),
                const SizedBox(height: 32),

                // ── Account Section ─────────────────────────────────────────
                _buildSectionTitle('ACCOUNT'),
                _buildSettingsGroup([
                  _SettingsTile(
                    title: 'Personal Information',
                    icon: Icons.person_outline_rounded,
                    onTap: () {},
                  ),
                  _SettingsTile(
                    title: 'Contact Information',
                    icon: Icons.contact_mail_outlined,
                    onTap: () {},
                  ),
                ]),
                const SizedBox(height: 24),

                // ── Access Section ──────────────────────────────────────────
                _buildSectionTitle('ACCESS'),
                _buildSettingsGroup([
                  _SettingsTile(
                    title: 'Role & Access',
                    icon: Icons.shield_outlined,
                    value: profile.authorization.role,
                    onTap: () => _showAccessSheet(context, profile),
                  ),
                  _SettingsTile(
                    title: 'Property Access',
                    icon: Icons.domain_rounded,
                    value: '\${profile.authorization.properties.length}',
                    onTap: () {},
                  ),
                ]),
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
                    title: 'Daily Executive Brief',
                    icon: Icons.insights_rounded,
                    value: profile.preferences.dailyBrief ? 'ON' : 'OFF',
                    onTap: () {},
                  ),
                  _SettingsTile(
                    title: 'Biometric Login',
                    icon: Icons.fingerprint_rounded,
                    value: 'ON', // Handled by device keychain usually
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
                    onTap: () {},
                  ),
                  _SettingsTile(
                    title: 'Active Sessions',
                    icon: Icons.devices_rounded,
                    value: '1 Active',
                    onTap: () {},
                  ),
                  _SettingsTile(
                    title: 'Security Activity',
                    icon: Icons.security_rounded,
                    onTap: () {},
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
                ]),
                const SizedBox(height: 40),

                // ── Logout Button ───────────────────────────────────────────
                GestureDetector(
                  onTap: () => _showLogoutConfirm(context, ref),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: _cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _red.withValues(alpha: 0.3)),
                    ),
                    child: const Center(
                      child: Text(
                        'LOG OUT',
                        style: TextStyle(
                          color: _red,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 32),
                
                // Footer
                const Text(
                  'LodgeCore Mobile\\nVersion 1.0.0\\n© 2026 LodgeCore',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: _textMuted, fontSize: 11, height: 1.6),
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
          const Text('Could not load profile',
              style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text('\$err', style: const TextStyle(color: _textSecondary, fontSize: 12)),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: () => ref.read(profileProvider.notifier).loadProfile(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(color: _goldLight, borderRadius: BorderRadius.circular(8)),
              child: const Text('Retry', style: TextStyle(color: _bgDeep, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  void _showLogoutConfirm(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardBg,
        title: const Text('Log Out', style: TextStyle(color: _textPrimary)),
        content: const Text('Are you sure you want to log out of LodgeCore?',
            style: TextStyle(color: _textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: _textMuted)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(authProvider.notifier).logout();
            },
            child: const Text('Log Out', style: TextStyle(color: _red)),
          ),
        ],
      ),
    );
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
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: _textMuted.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Access & Permissions',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _textPrimary)),
            const SizedBox(height: 24),
            
            const Text('ROLE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _textMuted, letterSpacing: 1.2)),
            const SizedBox(height: 8),
            Text(profile.authorization.role, style: const TextStyle(fontSize: 15, color: _textPrimary)),
            const SizedBox(height: 20),

            const Text('PROPERTIES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _textMuted, letterSpacing: 1.2)),
            const SizedBox(height: 8),
            ...profile.authorization.properties.map((p) => 
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(p.name, style: const TextStyle(fontSize: 15, color: _textPrimary)),
              )
            ),
            const SizedBox(height: 20),

            const Text('CAPABILITIES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _textMuted, letterSpacing: 1.2)),
            const SizedBox(height: 8),
            ...profile.authorization.capabilities.map((c) => 
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_rounded, color: _green, size: 16),
                    const SizedBox(width: 8),
                    Text(c, style: const TextStyle(fontSize: 14, color: _textSecondary)),
                  ],
                ),
              )
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _surfaceNavy,
                  foregroundColor: _textPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Close'),
              ),
            )
          ],
        ),
      ),
    );
  }
}

// ─── Header Card ──────────────────────────────────────────────────────────────

class _ProfileHeaderCard extends StatelessWidget {
  final UserProfileData profile;
  const _ProfileHeaderCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF1E3355)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          // Avatar
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: _surfaceNavy,
              shape: BoxShape.circle,
              border: Border.all(color: _goldLight.withValues(alpha: 0.3), width: 2),
            ),
            child: Center(
              child: Text(
                profile.user.initials.toUpperCase(),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: _goldLight,
                  letterSpacing: 1.5,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Name
          Text(
            profile.user.fullName.toUpperCase(),
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
              color: _textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),

          // Position
          if (profile.staff != null)
            Text(
              profile.staff!.position,
              style: const TextStyle(
                fontSize: 14,
                color: _textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          
          const SizedBox(height: 16),
          
          // Status indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 8, height: 8,
                decoration: const BoxDecoration(color: _green, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Text(
                "Active · \${profile.authorization.properties.isNotEmpty ? profile.authorization.properties.first.name : 'No Property'}",
                style: const TextStyle(fontSize: 12, color: _textMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Settings Components ──────────────────────────────────────────────────────

Widget _buildSectionTitle(String title) {
  return Padding(
    padding: const EdgeInsets.only(left: 4, bottom: 8),
    child: Text(
      title,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: _textMuted,
        letterSpacing: 1.5,
      ),
    ),
  );
}

Widget _buildSettingsGroup(List<Widget> children) {
  return Container(
    decoration: BoxDecoration(
      color: _cardBg,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFF1E3355)),
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
            Divider(color: const Color(0xFF1E3355).withValues(alpha: 0.5), height: 1, indent: 52),
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
  final bool showChevron;
  final VoidCallback onTap;

  const _SettingsTile({
    required this.title,
    required this.icon,
    this.value,
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
            if (value != null) ...[
              Text(
                value!,
                style: const TextStyle(fontSize: 14, color: _textMuted),
              ),
              const SizedBox(width: 8),
            ],
            if (showChevron)
              const Icon(Icons.chevron_right_rounded, color: _textMuted, size: 20),
          ],
        ),
      ),
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

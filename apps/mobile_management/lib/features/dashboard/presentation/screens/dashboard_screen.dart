import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/dashboard_provider.dart';
import '../models/executive_dashboard_data.dart';
import 'package:mobile_management/features/notifications/presentation/providers/notifications_provider.dart';
import 'package:mobile_management/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:mobile_management/features/profile/presentation/screens/profile_screen.dart';
import 'package:mobile_management/features/profile/presentation/providers/profile_provider.dart';
import 'package:mobile_management/features/profile/presentation/models/user_profile.dart';
import '../widgets/director/hero_revenue_card.dart';
import '../widgets/director/hero_kpi_strip.dart';
import '../widgets/director/operations_snapshot_card.dart';
import '../widgets/director/alerts_intel_card.dart';
import '../widgets/director/performance_trend_chart.dart';
import '../widgets/director/compact_room_status_widget.dart';
import '../widgets/director/sync_summary_widget.dart';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const _bgDeep = Color(0xFF070D1A);
const _navy = Color(0xFF0F172A);
const _surface = Color(0xFF111827);
const _border = Color(0xFF1E3048);
const _gold = Color(0xFFD4AF37);
const _emerald = Color(0xFF10B981);
const _textPrimary = Color(0xFFF8FAFC);
const _textSecondary = Color(0xFFCBD5E1);
const _textMuted = Color(0xFF94A3B8);

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _fadeController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeController, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  // Navigate to another tab — action is logged; tab switching
  // is handled via MainScreen's currentIndex state when this screen
  // is embedded inside it.
  void _handleAlertAction(String action) {
    // Tab-switching is driven by MainScreen; no-op here.
    // The alert chip text already communicates the destination to the user.
  }

  @override
  Widget build(BuildContext context) {
    final dashboardState = ref.watch(dashboardDataProvider);
    final unreadCount = ref.watch(unreadCountProvider);
    final profileState = ref.watch(profileProvider);
    final profile = profileState.value;
    final properties = profile?.authorization.properties ?? [];
    final multiProperty = properties.length > 1;

    // Fire fade-in once data arrives
    if (dashboardState.hasValue && !_fadeController.isCompleted) {
      _fadeController.forward();
    }

    return Scaffold(
      backgroundColor: _bgDeep,
      appBar: _buildAppBar(
        dashboardState.value,
        unreadCount,
        profile,
        multiProperty,
        ref,
      ),
      body: dashboardState.when(
        data: (data) => FadeTransition(
          opacity: _fadeAnim,
          child: RefreshIndicator(
            onRefresh: () async => ref.refresh(dashboardDataProvider.future),
            color: _gold,
            backgroundColor: _surface,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
              children: [
                // ── 1. Hero Revenue Card ──────────────────────────────────
                HeroRevenueCard(
                  overview: data.executiveOverview,
                  trends: data.performanceTrends,
                  businessDate: data.businessDate,
                ),
                const SizedBox(height: 14),

                // ── 2. KPI Strip (Occ · ADR · RevPAR · TRevPAR) ──────────
                _AnimatedSection(
                  delay: const Duration(milliseconds: 80),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SectionLabel(label: 'KEY PERFORMANCE INDICATORS'),
                      const SizedBox(height: 8),
                      HeroKpiStrip(overview: data.executiveOverview),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // ── 3. Operations Snapshot ────────────────────────────────
                _AnimatedSection(
                  delay: const Duration(milliseconds: 160),
                  child: OperationsSnapshotCard(
                    snapshot: data.todaySnapshot,
                    roomSummary: data.roomSummary,
                  ),
                ),
                const SizedBox(height: 14),

                // ── 4. Alerts Intelligence ────────────────────────────────
                if (data.requiresAttention.isNotEmpty)
                  _AnimatedSection(
                    delay: const Duration(milliseconds: 200),
                    child: AlertsIntelCard(
                      alerts: data.requiresAttention,
                      onActionTap: _handleAlertAction,
                    ),
                  ),
                if (data.requiresAttention.isNotEmpty) const SizedBox(height: 14),

                // ── 5. Room Status ────────────────────────────────────────
                _AnimatedSection(
                  delay: const Duration(milliseconds: 240),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SectionLabel(label: 'ROOM STATUS'),
                      const SizedBox(height: 8),
                      CompactRoomStatusWidget(summary: data.roomSummary),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // ── 6. Performance Trend Chart ────────────────────────────
                _AnimatedSection(
                  delay: const Duration(milliseconds: 320),
                  child: PerformanceTrendChart(trends: data.performanceTrends),
                ),
                const SizedBox(height: 14),

                // ── 7. Sync Health (slim pill) ────────────────────────────
                _AnimatedSection(
                  delay: const Duration(milliseconds: 400),
                  child: SyncSummaryWidget(summary: data.syncSummary),
                ),

                // Unaudited disclaimer
                const SizedBox(height: 12),
                const _UnauditedNote(),
              ],
            ),
          ),
        ),
        loading: () => _buildSkeleton(),
        error: (error, stack) => _buildError(ref),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(
    ExecutiveDashboardData? data,
    int unreadCount,
    UserProfileData? profile,
    bool multiProperty,
    WidgetRef ref,
  ) {
    final propertyName = data?.propertyName
        ?? profile?.authorization.properties.firstOrNull?.name
        ?? 'Loading…';
    final role = _formatRole(profile?.authorization.role ?? '');
    final initials = profile?.user.initials ?? '?';

    return AppBar(
      backgroundColor: _bgDeep,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      centerTitle: false,
      titleSpacing: 16,
      title: GestureDetector(
        onTap: multiProperty
            ? () => _showPropertySwitcher(context, profile!)
            : null,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Property icon badge
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1A2535), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _gold.withValues(alpha: 0.25),
                  width: 1.5,
                ),
              ),
              child: const Icon(
                Icons.apartment_rounded,
                color: _gold,
                size: 20,
              ),
            ),
            const SizedBox(width: 10),

            // Property name + role + live row
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Property name row + optional chevron
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          propertyName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: _textPrimary,
                            letterSpacing: -0.4,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      // Chevron ONLY when multi-property
                      if (multiProperty) ...[
                        const SizedBox(width: 2),
                        Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: _gold.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: _gold,
                            size: 16,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  // Role badge + live indicator row
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Role pill
                      if (role.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: _gold.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: _gold.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Text(
                            role,
                            style: const TextStyle(
                              color: _gold,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      if (role.isNotEmpty && data != null)
                        const SizedBox(width: 6),
                      // Live dot + time
                      if (data != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _LiveDot(),
                            const SizedBox(width: 4),
                            Text(
                              _getTimeAgo(data.lastUpdatedAt),
                              style: const TextStyle(
                                color: _textMuted,
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        // Notification bell with gold count badge
        Stack(
          alignment: Alignment.center,
          children: [
            IconButton(
              icon: const Icon(
                Icons.notifications_outlined,
                color: _textSecondary,
              ),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const NotificationsScreen(),
                  ),
                );
              },
            ),
            if (unreadCount > 0)
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: _gold,
                    shape: BoxShape.circle,
                    border: Border.all(color: _bgDeep, width: 1.5),
                  ),
                  child: Text(
                    unreadCount > 99 ? '99+' : unreadCount.toString(),
                    style: const TextStyle(
                      color: _navy,
                      fontSize: 8,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(width: 2),
        // Avatar with user initials
        GestureDetector(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            );
          },
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  _gold.withValues(alpha: 0.2),
                  _gold.withValues(alpha: 0.08),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              border: Border.all(
                color: _gold.withValues(alpha: 0.4),
                width: 1.5,
              ),
            ),
            child: Center(
              child: Text(
                initials.toUpperCase(),
                style: const TextStyle(
                  color: _gold,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
      ],
    );
  }

  /// Formats role string to a human-readable short label.
  String _formatRole(String role) {
    switch (role.toUpperCase()) {
      case 'DIRECTOR':
        return 'DIRECTOR';
      case 'GENERAL_MANAGER':
      case 'GM':
        return 'GEN. MANAGER';
      case 'MANAGER':
        return 'MANAGER';
      case 'FRONT_DESK':
        return 'FRONT DESK';
      case 'FINANCE_MANAGER':
        return 'FINANCE MGR';
      default:
        return role.isEmpty ? '' : role.replaceAll('_', ' ');
    }
  }

  /// Shows a bottom sheet to switch between properties (multi-property users only).
  void _showPropertySwitcher(
    BuildContext ctx,
    UserProfileData profile,
  ) {
    showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _PropertySwitcherSheet(profile: profile),
    );
  }

  Widget _buildSkeleton() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
      children: [
        _SkeletonCard(height: 200),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _SkeletonCard(height: 100)),
          const SizedBox(width: 6),
          Expanded(child: _SkeletonCard(height: 100)),
          const SizedBox(width: 6),
          Expanded(child: _SkeletonCard(height: 100)),
          const SizedBox(width: 6),
          Expanded(child: _SkeletonCard(height: 100)),
        ]),
        const SizedBox(height: 14),
        _SkeletonCard(height: 160),
        const SizedBox(height: 14),
        _SkeletonCard(height: 120),
        const SizedBox(height: 14),
        _SkeletonCard(height: 180),
      ],
    );
  }

  Widget _buildError(WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: _surface,
              shape: BoxShape.circle,
              border: Border.all(color: _border),
            ),
            child: const Icon(Icons.cloud_off_rounded, color: _textMuted, size: 36),
          ),
          const SizedBox(height: 20),
          const Text(
            'Unable to load dashboard',
            style: TextStyle(
              color: _textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Check your connection and try again.',
            style: TextStyle(color: _textMuted, fontSize: 13),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => ref.refresh(dashboardDataProvider.future),
            style: ElevatedButton.styleFrom(
              backgroundColor: _surface,
              foregroundColor: _gold,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: _gold, width: 1),
              ),
            ),
            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  void _showComingSoonPopup(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _bgDeep,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: _gold.withValues(alpha: 0.3), width: 1.5),
        ),
        contentPadding: const EdgeInsets.all(32),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _gold.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.rocket_launch_rounded, color: _gold, size: 48),
            ),
            const SizedBox(height: 24),
            const Text(
              'COMING SOON',
              style: TextStyle(
                color: _gold,
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'This feature is currently under development. Stay tuned.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _textMuted,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _gold,
                  foregroundColor: _bgDeep,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Got it',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getTimeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Tab-navigation interface placeholder.
/// Full wiring is done in MainScreen via index state.
class _MainScreenStateAccessor {
  void switchTab(int index) {}
}


class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) => Text(
        label,
        style: const TextStyle(
          color: _textMuted,
          fontSize: 10,
          letterSpacing: 1.5,
          fontWeight: FontWeight.w700,
        ),
      );
}

/// Fades in each section with a small delay for a staggered reveal.
class _AnimatedSection extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const _AnimatedSection({required this.child, required this.delay});

  @override
  State<_AnimatedSection> createState() => _AnimatedSectionState();
}

class _AnimatedSectionState extends State<_AnimatedSection>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    Future.delayed(widget.delay, () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: _anim,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.04),
            end: Offset.zero,
          ).animate(_anim),
          child: widget.child,
        ),
      );
}

/// Slim pulsing live indicator dot.
class _LiveDot extends StatefulWidget {
  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _anim,
        builder: (_, __) => Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(
            color: _emerald.withValues(alpha: _anim.value),
            shape: BoxShape.circle,
          ),
        ),
      );
}

/// Skeleton loading shimmer card.
class _SkeletonCard extends StatefulWidget {
  final double height;
  const _SkeletonCard({required this.height});

  @override
  State<_SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<_SkeletonCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<Color?> _colorAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _colorAnim = ColorTween(
      begin: const Color(0xFF111827),
      end: const Color(0xFF1A2535),
    ).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _colorAnim,
        builder: (_, __) => Container(
          height: widget.height,
          decoration: BoxDecoration(
            color: _colorAnim.value,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _border),
          ),
        ),
      );
}

/// Small unaudited footnote at the bottom.
class _UnauditedNote extends StatelessWidget {
  const _UnauditedNote();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Text(
          '* RevPAR, TRevPAR and live revenue figures are provisional until night audit completes.',
          style: const TextStyle(
            color: _textMuted,
            fontSize: 10,
          ),
          textAlign: TextAlign.center,
        ),
      );
}

// ─── Property Switcher Bottom Sheet ───────────────────────────────────────────

/// Premium bottom sheet for multi-property users to switch active property.
/// Only shown when the user has more than one property assigned.
class _PropertySwitcherSheet extends StatelessWidget {
  final UserProfileData profile;

  const _PropertySwitcherSheet({required this.profile});

  @override
  Widget build(BuildContext context) {
    final properties = profile.authorization.properties;
    const sheetBg = Color(0xFF0F172A);
    const cardBg = Color(0xFF111827);
    const border = Color(0xFF1E3048);
    const gold = Color(0xFFD4AF37);
    const textPrimary = Color(0xFFF8FAFC);
    const textMuted = Color(0xFF94A3B8);
    const emerald = Color(0xFF10B981);

    return Container(
      decoration: const BoxDecoration(
        color: sheetBg,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: gold.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: gold.withValues(alpha: 0.2)),
                  ),
                  child: const Icon(Icons.apartment_rounded, color: gold, size: 16),
                ),
                const SizedBox(width: 12),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'SWITCH PROPERTY',
                      style: TextStyle(
                        color: textMuted,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Select active property',
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: border,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.close_rounded, color: textMuted, size: 16),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Thin divider
          Container(height: 1, color: border),
          const SizedBox(height: 8),

          // Property list
          ...properties.asMap().entries.map((entry) {
            final idx = entry.key;
            final prop = entry.value;
            // First property is treated as active (current selection)
            final isActive = idx == 0;

            return GestureDetector(
              onTap: () {
                // TODO: wire up property switching via provider
                Navigator.of(context).pop();
              },
              child: AnimatedContainer(
                duration: Duration(milliseconds: 150 + idx * 50),
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isActive
                      ? gold.withValues(alpha: 0.06)
                      : cardBg,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isActive
                        ? gold.withValues(alpha: 0.3)
                        : border,
                    width: isActive ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    // Property initial badge
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isActive
                              ? [
                                  gold.withValues(alpha: 0.2),
                                  gold.withValues(alpha: 0.08),
                                ]
                              : [
                                  border.withValues(alpha: 0.8),
                                  border.withValues(alpha: 0.4),
                                ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isActive
                              ? gold.withValues(alpha: 0.3)
                              : border,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          prop.name.isNotEmpty
                              ? prop.name[0].toUpperCase()
                              : 'P',
                          style: TextStyle(
                            color: isActive ? gold : textMuted,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Name + code
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            prop.name,
                            style: TextStyle(
                              color: isActive ? textPrimary : textPrimary.withValues(alpha: 0.7),
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (prop.code != null && prop.code!.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              prop.code!,
                              style: const TextStyle(
                                color: textMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    // Active indicator
                    if (isActive)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: emerald.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: emerald.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 5,
                              height: 5,
                              decoration: const BoxDecoration(
                                color: emerald,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Text(
                              'ACTIVE',
                              style: TextStyle(
                                color: emerald,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: textMuted,
                        size: 18,
                      ),
                  ],
                ),
              ),
            );
          }),

          // Bottom safe area
          const SizedBox(height: 12),
          SafeArea(child: const SizedBox.shrink()),
        ],
      ),
    );
  }
}

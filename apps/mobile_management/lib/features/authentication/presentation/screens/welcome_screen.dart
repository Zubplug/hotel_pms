import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final compact = size.height < 760;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: Stack(
        children: [
          // ── Hero gradient top half ──────────────────────────────────────
          Positioned(
            top: 0, left: 0, right: 0,
            height: size.height * 0.58,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF172554), // Darker Blue
                    Color(0xFF1E3A8A), // LodgeCore Primary
                    Color(0xFF1D4ED8),
                    Color(0xFF2563EB),
                  ],
                ),
              ),
            ),
          ),

          // ── Decorative circles on hero ──────────────────────────────────
          Positioned(
            top: -60, right: -60,
            child: Container(
              width: 220, height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.06),
              ),
            ),
          ),
          Positioned(
            top: 40, left: -80,
            child: Container(
              width: 260, height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.04),
              ),
            ),
          ),
          Positioned(
            top: size.height * 0.30, right: 20,
            child: Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),

          // ── Bottom white card surface ───────────────────────────────────
          Positioned(
            bottom: 0, left: 0, right: 0,
            height: size.height * 0.50,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
            ),
          ),

          // ── Main content ────────────────────────────────────────────────
          SafeArea(
            child: FadeTransition(
              opacity: _fade,
              child: SlideTransition(
                position: _slide,
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: compact ? 20 : 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(height: compact ? 20 : 28),

                      // Brand wordmark row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.30)),
                            ),
                            child: const Text('MANAGER',
                              style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.8)),
                          ),
                          const SizedBox(width: 8),
                          RichText(
                            text: const TextSpan(
                              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.5),
                              children: [
                                TextSpan(text: 'Lodge', style: TextStyle(color: Colors.white)),
                                TextSpan(text: 'Core', style: TextStyle(color: Colors.white70)),
                              ],
                            ),
                          ),
                        ],
                      ),

                      SizedBox(height: compact ? 24 : 32),

                      // Logo Icon
                      Center(
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0.85, end: 1.0),
                          duration: const Duration(milliseconds: 700),
                          curve: Curves.easeOutBack,
                          builder: (context, scale, child) => Transform.scale(scale: scale, child: child),
                          child: const Icon(
                            Icons.apartment_rounded,
                            color: Colors.white,
                            size: 100,
                          ),
                        ),
                      ),

                      SizedBox(height: compact ? 6 : 8),

                      // Headline
                      Text(
                        'Total Control.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: compact ? 38 : 44,
                          fontWeight: FontWeight.w900,
                          height: 1.0,
                          letterSpacing: -1.5,
                        ),
                      ),

                      SizedBox(height: compact ? 6 : 8),

                      // Subtext
                      Text(
                        'Monitor operations, approve requests, and lead your hotel from anywhere.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.80),
                          fontSize: compact ? 14.5 : 15.5,
                          fontWeight: FontWeight.w500,
                          height: 1.4,
                        ),
                      ),

                      const Spacer(),

                      // Service pills
                      Center(
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: const [
                            _ServicePill(icon: Icons.bar_chart, label: 'Analytics'),
                            _ServicePill(icon: Icons.notifications_active, label: 'Alerts'),
                            _ServicePill(icon: Icons.check_circle_outline, label: 'Approvals'),
                            _ServicePill(icon: Icons.security, label: 'Audit Trail'),
                          ],
                        ),
                      ),

                      SizedBox(height: compact ? 20 : 24),

                      // Login button
                      SizedBox(
                        height: compact ? 54 : 58,
                        child: FilledButton(
                          onPressed: () => context.go('/login'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF1E3A8A),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            textStyle: TextStyle(fontSize: compact ? 16 : 17, fontWeight: FontWeight.w900, letterSpacing: -0.2),
                            elevation: 0,
                          ),
                          child: const Text('Login to Command Center'),
                        ),
                      ),

                      SizedBox(height: compact ? 14 : 18),

                      // Trust line
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lock_rounded, size: 12, color: Colors.grey),
                          const SizedBox(width: 6),
                          Text(
                            'Bank-grade security · Executive Access Only',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: compact ? 11 : 11.5,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.1,
                            ),
                          ),
                        ],
                      ),

                      SizedBox(height: compact ? 12 : 16),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Service Pill ─────────────────────────────────────────────────────────────

class _ServicePill extends StatelessWidget {
  const _ServicePill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.grey.shade200, width: 1.2),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF1E3A8A)),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(color: Colors.black87, fontSize: 12, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dart:math' as math;

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    // Simulate reading tokens, checking biometric status, etc.
    await Future<void>.delayed(const Duration(milliseconds: 2200));

    if (!mounted) return;
    
    // For now, always navigate to welcome. 
    // If the user had a token, we'd navigate to '/' instead.
    context.go('/welcome');
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SecureBootLoadingView(),
    );
  }
}

// ─────────────────────────────────────────────
// Main Boot Screen UI
// ─────────────────────────────────────────────

class SecureBootLoadingView extends StatelessWidget {
  final String message;

  const SecureBootLoadingView({
    super.key,
    this.message = 'Securing command center...',
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // ── Light background ──
        Positioned.fill(
          child: const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFF3F4F6),
                  Colors.white,
                ],
              ),
            ),
          ),
        ),

        // ── Subtle blue glow top-right ──
        Positioned(
          top: -80, right: -80,
          child: Container(
            width: 280, height: 280,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(colors: [
                const Color(0xFF1E3A8A).withValues(alpha: 0.10),
                Colors.transparent,
              ]),
            ),
          ),
        ),
        
        // ── Subtle cyan glow bottom-left ──
        Positioned(
          bottom: -100, left: -60,
          child: Container(
            width: 320, height: 320,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(colors: [
                const Color(0xFF3B82F6).withValues(alpha: 0.08),
                Colors.transparent,
              ]),
            ),
          ),
        ),

        // ── Animated scan line ──
        const _ScanLine(),

        // ── Main content ──
        SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: _BootContent(
                message: message,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _BootContent extends StatefulWidget {
  final String message;

  const _BootContent({required this.message});

  @override
  State<_BootContent> createState() => _BootContentState();
}

class _BootContentState extends State<_BootContent>
    with TickerProviderStateMixin {
  late final List<AnimationController> _ctrls;
  late final List<Animation<double>> _fades;
  late final List<Animation<Offset>> _slides;

  static const _delays = [0, 180, 320, 480];

  @override
  void initState() {
    super.initState();
    _ctrls = List.generate(
      4,
      (_) => AnimationController(vsync: this, duration: const Duration(milliseconds: 650)),
    );
    _fades = _ctrls.map((c) => CurvedAnimation(parent: c, curve: Curves.easeOut)).toList();
    _slides = _ctrls.map((c) =>
      Tween<Offset>(begin: const Offset(0, 0.25), end: Offset.zero)
          .animate(CurvedAnimation(parent: c, curve: Curves.easeOutCubic))).toList();

    for (int i = 0; i < _ctrls.length; i++) {
      Future.delayed(Duration(milliseconds: _delays[i]), () {
        if (mounted) _ctrls[i].forward();
      });
    }
  }

  @override
  void dispose() {
    for (final c in _ctrls) { c.dispose(); }
    super.dispose();
  }

  Widget _anim(int i, Widget child) => FadeTransition(
    opacity: _fades[i],
    child: SlideTransition(position: _slides[i], child: child),
  );

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 0 — Logo
        _anim(0, const _LogoWithRings()),

        const SizedBox(height: 22),

        // 1 — Wordmark
        _anim(1, RichText(
          text: const TextSpan(
            style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -0.8),
            children: [
              TextSpan(text: 'Lodge', style: TextStyle(color: Colors.black87)),
              TextSpan(text: 'Core', style: TextStyle(color: Color(0xFF1E3A8A))),
            ],
          ),
        )),

        const SizedBox(height: 8),
        _anim(1, const Text(
          'Executive Management',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.black54,
            fontSize: 13,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.1,
          ),
        )),

        const SizedBox(height: 48),

        // 2 — Status row
        _anim(2, Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _DotTrail(),
            const SizedBox(width: 10),
            Text(
              widget.message,
              style: const TextStyle(
                color: Colors.black87,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.1,
              ),
            ),
          ],
        )),
        
        const SizedBox(height: 20),

        // 3 — Security badge
        _anim(3, Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF1E3A8A).withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: const Color(0xFF1E3A8A).withValues(alpha: 0.18)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _PulseDot(color: Color(0xFF1E3A8A)),
              const SizedBox(width: 8),
              const Text(
                'SECURE COMMAND CENTER',
                style: TextStyle(
                  color: Color(0xFF172554), // Darker Blue
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
        )),
      ],
    );
  }
}

class _LogoWithRings extends StatefulWidget {
  const _LogoWithRings();

  @override
  State<_LogoWithRings> createState() => _LogoWithRingsState();
}

class _LogoWithRingsState extends State<_LogoWithRings>
    with TickerProviderStateMixin {
  late final AnimationController _ring1;
  late final AnimationController _ring2;
  late final AnimationController _scaleCtrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();

    _ring1 = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat();

    _ring2 = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4500),
    )..repeat();

    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _scale = Tween<double>(
      begin: 0.75,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut));
    _scaleCtrl.forward();
  }

  @override
  void dispose() {
    _ring1.dispose();
    _ring2.dispose();
    _scaleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: SizedBox(
        width: 120,
        height: 120,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Outer ring (slow, reverse, cyan)
            AnimatedBuilder(
              animation: _ring2,
              builder: (_, _) => Transform.rotate(
                angle: -_ring2.value * 2 * math.pi,
                child: CustomPaint(
                  size: const Size(120, 120),
                  painter: _SpinRingPainter(
                    color: const Color(0xFF3B82F6),
                    opacity: 0.28,
                    strokeWidth: 1.0,
                    sweepFraction: 0.45,
                  ),
                ),
              ),
            ),

            // Inner ring (fast, blue)
            AnimatedBuilder(
              animation: _ring1,
              builder: (_, _) => Transform.rotate(
                angle: _ring1.value * 2 * math.pi,
                child: CustomPaint(
                  size: const Size(108, 108),
                  painter: _SpinRingPainter(
                    color: const Color(0xFF1E3A8A),
                    opacity: 0.70,
                    strokeWidth: 1.5,
                    sweepFraction: 0.3,
                  ),
                ),
              ),
            ),

            // Logo tile
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFFE0E7FF),
                    Color(0xFFDBEAFE),
                  ],
                ),
                border: Border.all(
                  color: const Color(0xFF93C5FD).withValues(alpha: 0.45),
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(23),
                child: Stack(
                  children: [
                    // Gloss overlay
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 44,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.white.withValues(alpha: 0.5),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                    // App logo
                    const Center(
                      child: Icon(
                        Icons.apartment_rounded,
                        color: Color(0xFF1E3A8A),
                        size: 40,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpinRingPainter extends CustomPainter {
  final Color color;
  final double opacity;
  final double strokeWidth;
  final double sweepFraction;

  const _SpinRingPainter({
    required this.color,
    required this.opacity,
    required this.strokeWidth,
    required this.sweepFraction,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(
      strokeWidth / 2,
      strokeWidth / 2,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: sweepFraction * 2 * math.pi,
        colors: [
          color.withValues(alpha: opacity),
          color.withValues(alpha: 0.0),
        ],
      ).createShader(rect);

    canvas.drawArc(rect, 0, sweepFraction * 2 * math.pi, false, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _DotTrail extends StatefulWidget {
  const _DotTrail();

  @override
  State<_DotTrail> createState() => _DotTrailState();
}

class _DotTrailState extends State<_DotTrail>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        final start = i / 5.0;
        final end = start + 0.4;
        final anim = Tween<double>(begin: 0.2, end: 1.0).animate(
          CurvedAnimation(
            parent: _ctrl,
            curve: Interval(start, end.clamp(0, 1), curve: Curves.easeInOut),
          ),
        );
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2.5),
          child: AnimatedBuilder(
            animation: anim,
            builder: (_, child) => Transform.scale(
              scale: 0.8 + anim.value * 0.4,
              child: Opacity(
                opacity: anim.value,
                child: Container(
                  width: 5,
                  height: 5,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF1E3A8A).withValues(alpha: 0.90),
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _ScanLine extends StatefulWidget {
  const _ScanLine();

  @override
  State<_ScanLine> createState() => _ScanLineState();
}

class _ScanLineState extends State<_ScanLine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _pos;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: false);

    _pos = Tween<double>(
      begin: 0.08,
      end: 0.92,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.linear));
    _fade = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: 1.0), weight: 8),
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 84),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0), weight: 8),
    ]).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        return Positioned(
          top: MediaQuery.of(context).size.height * _pos.value,
          left: 0,
          right: 0,
          child: Opacity(
            opacity: _fade.value,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    const Color(0xFF3B82F6).withValues(alpha: 0.40),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _PulseDot extends StatefulWidget {
  final Color color;
  const _PulseDot({required this.color});

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _scale = Tween<double>(begin: 0.7, end: 1.3)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _scale,
      builder: (_, child) => Transform.scale(
        scale: _scale.value,
        child: Container(
          width: 6, height: 6,
          decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color),
        ),
      ),
    );
  }
}

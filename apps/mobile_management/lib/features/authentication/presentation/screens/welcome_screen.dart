import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

const _navy = Color(0xFF071321);
const _navySoft = Color(0xFF10243A);
const _gold = Color(0xFFD6A956);
const _ink = Color(0xFFEAF0F5);
const _muted = Color(0xFF8EA2B7);

class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    ref.read(authProvider.notifier).markWelcomeShown();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _navy,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_navy, _navySoft, _navy],
                ),
              ),
            ),
          ),
          Positioned(
            top: -180,
            right: -120,
            child: _Glow(color: _gold.withValues(alpha: 0.16), size: 420),
          ),
          Positioned(
            bottom: -180,
            left: -150,
            child: _Glow(
              color: const Color(0xFF3875A5).withValues(alpha: 0.18),
              size: 430,
            ),
          ),
          SafeArea(
            child: FadeTransition(
              opacity: _fade,
              child: SlideTransition(
                position: _slide,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final short = constraints.maxHeight < 700;
                    return SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(24, short ? 18 : 28, 24, 20),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: constraints.maxHeight - 48,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildHeader(),
                            SizedBox(height: short ? 34 : 58),
                            _buildHero(short),
                            SizedBox(height: short ? 30 : 52),
                            _buildAccessCard(short),
                            const SizedBox(height: 18),
                            const Center(
                              child: Text(
                                'Private operational workspace  ·  v1.0',
                                style: TextStyle(
                                  color: _muted,
                                  fontSize: 10,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: _gold.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: _gold.withValues(alpha: 0.5)),
          ),
          child: const Icon(Icons.apartment_rounded, color: _gold, size: 21),
        ),
        const SizedBox(width: 12),
        const Text(
          'LODGECORE',
          style: TextStyle(
            color: _ink,
            fontSize: 16,
            fontWeight: FontWeight.w800,
            letterSpacing: 2.4,
          ),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
          ),
          child: const Text(
            'MANAGER',
            style: TextStyle(
              color: _gold,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHero(bool short) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(width: 28, height: 1, color: _gold),
            const SizedBox(width: 9),
            const Text(
              'HOTEL OPERATIONS',
              style: TextStyle(
                color: _gold,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.8,
              ),
            ),
          ],
        ),
        SizedBox(height: short ? 12 : 18),
        Text(
          'Lead every stay\nwith clarity.',
          style: TextStyle(
            color: _ink,
            fontSize: short ? 38 : 48,
            height: 0.99,
            fontWeight: FontWeight.w800,
            letterSpacing: -1.8,
          ),
        ),
        const SizedBox(height: 16),
        const SizedBox(
          width: 350,
          child: Text(
            'One calm command centre for rooms, revenue, approvals, and the decisions that keep your property moving.',
            style: TextStyle(color: _muted, fontSize: 14, height: 1.55),
          ),
        ),
      ],
    );
  }

  Widget _buildAccessCard(bool short) {
    return Container(
      padding: EdgeInsets.all(short ? 17 : 20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.11)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFF18364C),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.insights_rounded,
                  color: Color(0xFF91D1D2),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your shift, in view',
                      style: TextStyle(
                        color: _ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Live signals across your property',
                      style: TextStyle(color: _muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_rounded, color: _gold, size: 19),
            ],
          ),
          SizedBox(height: short ? 16 : 20),
          SizedBox(
            width: double.infinity,
            height: short ? 52 : 56,
            child: FilledButton(
              onPressed: () => context.go('/login'),
              style: FilledButton.styleFrom(
                backgroundColor: _gold,
                foregroundColor: _navy,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                textStyle: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              child: const Text('Enter command centre'),
            ),
          ),
          const SizedBox(height: 13),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.shield_outlined, color: _muted, size: 14),
              SizedBox(width: 6),
              Text(
                'Protected staff access',
                style: TextStyle(color: _muted, fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  final Color color;
  final double size;

  const _Glow({required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [color, Colors.transparent]),
      ),
    );
  }
}

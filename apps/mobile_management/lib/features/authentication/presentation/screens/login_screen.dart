import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../providers/auth_provider.dart';

// ─── Colour Palette ───────────────────────────────────────────────────────────
const _bgDeep     = Color(0xFF070D1A);
const _goldLight  = Color(0xFFD4A853);
const _goldDark   = Color(0xFF9A7230);
const _cardBg     = Color(0xFF111D33);
const _inputBg    = Color(0xFF0F1A2E);
const _inputBorder = Color(0xFF1E3A5F);
const _inputFocus  = Color(0xFFD4A853);
const _textPrimary = Color(0xFFEEF2FF);
const _textMuted   = Color(0xFF6B7FA3);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with TickerProviderStateMixin {
  final _formKey    = GlobalKey<FormState>();
  final _emailCtrl  = TextEditingController();
  final _passCtrl   = TextEditingController();
  bool _obscure     = true;
  bool _isLoading   = false;
  String? _errorMessage;

  late final AnimationController _entryCtrl;
  late final Animation<double>   _fadeAnim;
  late final Animation<Offset>   _slideAnim;
  late final AnimationController _pulseCtrl;
  late final Animation<double>   _pulseAnim;

  @override
  void initState() {
    super.initState();

    _entryCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));
    _fadeAnim  = CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic));

    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.85, end: 1.0)
        .animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _entryCtrl.forward();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    _pulseCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isLoading = true; _errorMessage = null; });
    HapticFeedback.lightImpact();

    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post('/manager/auth/login', data: {
        'email': _emailCtrl.text.trim(),
        'password': _passCtrl.text,
      });

      if (res.statusCode == 200) {
        final token = res.data['data']['token'] as String?;
        if (token != null) {
          HapticFeedback.mediumImpact();
          await ref.read(authProvider.notifier).login(token);
        }
      }
    } catch (e) {
      HapticFeedback.heavyImpact();
      String errorMsg = 'Invalid email or password. Please try again.';
      if (e.runtimeType.toString().contains('DioException')) {
        final dynamic dioError = e;
        final data = dioError.response?.data;
        if (data != null && data is Map && data['message'] != null) {
          errorMsg = '${dioError.response?.statusCode}: ${data['message']}';
        } else {
          errorMsg = '${dioError.response?.statusCode}: ${dioError.message}';
        }
      } else {
        errorMsg = e.toString();
      }
      debugPrint('LOGIN ERROR: $e');
      setState(() => _errorMessage = errorMsg);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bgDeep,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            // ── Ambient glow top-left ──
            Positioned(
              top: -80, left: -80,
              child: _GlowBlob(color: const Color(0xFF1A3A6B), size: 320),
            ),
            // ── Ambient glow bottom-right ──
            Positioned(
              bottom: -100, right: -80,
              child: _GlowBlob(color: const Color(0xFF2A1A0A), size: 380),
            ),
            // ── Subtle gold accent line top ──
            Positioned(
              top: 0, left: 0, right: 0,
              child: Container(
                height: 2,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [
                    Colors.transparent, _goldDark, _goldLight, _goldDark, Colors.transparent,
                  ]),
                ),
              ),
            ),

            // ── Main scrollable content ──
            SafeArea(
              child: FadeTransition(
                opacity: _fadeAnim,
                child: SlideTransition(
                  position: _slideAnim,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      return SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: constraints.maxHeight,
                          ),
                          child: IntrinsicHeight(
                            child: Form(
                              key: _formKey,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  const Spacer(flex: 3),

                                  // ── Logo Mark ──────────────────────────────────
                                  ScaleTransition(
                                    scale: _pulseAnim,
                                    child: Container(
                                      width: 76,
                                      height: 76,
                                      decoration: BoxDecoration(
                                        color: _cardBg,
                                        borderRadius: BorderRadius.circular(24),
                                        border: Border.all(
                                          color: _goldDark.withValues(alpha: 0.6),
                                          width: 1.5,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: _goldDark.withValues(alpha: 0.2),
                                            blurRadius: 24,
                                            spreadRadius: 2,
                                          ),
                                        ],
                                      ),
                                      child: const Icon(
                                        Icons.vpn_key_rounded,
                                        color: _goldLight,
                                        size: 34,
                                      ),
                                    ),
                                  ),

                                  const SizedBox(height: 16),

                                  // ── Brand Name ─────────────────────────────────
                                  const Text(
                                    'LodgeCore',
                                    style: TextStyle(
                                      fontSize: 36,
                                      fontWeight: FontWeight.w800,
                                      color: _textPrimary,
                                      letterSpacing: -1,
                                      height: 1.1,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'MANAGEMENT PORTAL',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _goldLight,
                                      letterSpacing: 4,
                                    ),
                                  ),

                                  const Spacer(flex: 4),

                                  // ── Login Card ─────────────────────────────────
                                  Container(
                                    decoration: BoxDecoration(
                                      color: _cardBg,
                                      borderRadius: BorderRadius.circular(28),
                                      border: Border.all(
                                        color: const Color(0xFF1E3355),
                                        width: 1,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.5),
                                          blurRadius: 40,
                                          offset: const Offset(0, 16),
                                        ),
                                      ],
                                    ),
                                    padding: const EdgeInsets.all(28),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'Sign in to your account',
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.w700,
                                            color: _textPrimary,
                                            letterSpacing: -0.3,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        const Text(
                                          'Authorized personnel only',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: _textMuted,
                                          ),
                                        ),
                                        const SizedBox(height: 28),

                                        // Email
                                        _PremiumField(
                                          controller: _emailCtrl,
                                          label: 'Email Address',
                                          hint: 'you@lodgecore.com',
                                          prefixIcon: Icons.alternate_email_rounded,
                                          keyboardType: TextInputType.emailAddress,
                                          validator: (v) =>
                                              (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
                                        ),

                                        const SizedBox(height: 18),

                                        // Password
                                        _PremiumField(
                                          controller: _passCtrl,
                                          label: 'Password',
                                          hint: '••••••••••',
                                          prefixIcon: Icons.shield_outlined,
                                          obscure: _obscure,
                                          validator: (v) =>
                                              (v == null || v.length < 4) ? 'Enter your password' : null,
                                          suffix: GestureDetector(
                                            onTap: () => setState(() => _obscure = !_obscure),
                                            child: Icon(
                                              _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                              color: _textMuted,
                                              size: 20,
                                            ),
                                          ),
                                        ),

                                        const SizedBox(height: 12),

                                        // Forgot password
                                        Align(
                                          alignment: Alignment.centerRight,
                                          child: GestureDetector(
                                            onTap: () {},
                                            child: const Text(
                                              'Forgot password?',
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: _goldLight,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                        ),

                                        const SizedBox(height: 28),

                                        // Error message
                                        if (_errorMessage != null) ...[
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                            decoration: BoxDecoration(
                                              color: Colors.red.withValues(alpha: 0.08),
                                              borderRadius: BorderRadius.circular(12),
                                              border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                                            ),
                                            child: Row(
                                              children: [
                                                const Icon(Icons.error_outline, color: Colors.redAccent, size: 16),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Text(
                                                    _errorMessage!,
                                                    style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(height: 20),
                                        ],

                                        // Sign In Button
                                        _GoldButton(
                                          label: 'Sign In',
                                          isLoading: _isLoading,
                                          onTap: _handleLogin,
                                        ),
                                      ],
                                    ),
                                  ),

                                  const Spacer(flex: 3),

                                  // ── Divider ────────────────────────────────────
                                  Row(children: [
                                    Expanded(child: Divider(color: _inputBorder.withValues(alpha: 0.5))),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 16),
                                      child: Text('or continue with',
                                          style: TextStyle(color: _textMuted, fontSize: 12)),
                                    ),
                                    Expanded(child: Divider(color: _inputBorder.withValues(alpha: 0.5))),
                                  ]),

                                  const SizedBox(height: 24),

                                  // ── Biometric ──────────────────────────────────
                                  GestureDetector(
                                    onTap: () {},
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                                      decoration: BoxDecoration(
                                        color: _cardBg,
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(color: _inputBorder),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.fingerprint_rounded, color: _goldLight, size: 28),
                                          const SizedBox(width: 12),
                                          const Text(
                                            'Biometric Login',
                                            style: TextStyle(
                                              color: _textPrimary,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 15,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                  const Spacer(flex: 4),

                                  // Footer
                                  Text(
                                    '© ${DateTime.now().year} LodgeCore · All rights reserved',
                                    style: const TextStyle(color: _textMuted, fontSize: 11),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 16),
                                ],
                              ),
                            ),
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
      ),
    );
  }
}

// ─── Ambient Glow Blob ────────────────────────────────────────────────────────

class _GlowBlob extends StatelessWidget {
  final Color color;
  final double size;
  const _GlowBlob({required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [
          color.withValues(alpha: 0.45),
          color.withValues(alpha: 0),
        ]),
      ),
    );
  }
}

// ─── Premium Input Field ──────────────────────────────────────────────────────

class _PremiumField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData prefixIcon;
  final bool obscure;
  final Widget? suffix;
  final TextInputType keyboardType;
  final String? Function(String?)? validator;

  const _PremiumField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.prefixIcon,
    this.obscure = false,
    this.suffix,
    this.keyboardType = TextInputType.text,
    this.validator,
  });

  @override
  State<_PremiumField> createState() => _PremiumFieldState();
}

class _PremiumFieldState extends State<_PremiumField> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: _focused ? _goldLight : _textMuted,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        Focus(
          onFocusChange: (f) => setState(() => _focused = f),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              color: _inputBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: _focused ? _inputFocus : _inputBorder,
                width: _focused ? 1.5 : 1,
              ),
              boxShadow: _focused
                  ? [BoxShadow(color: _goldDark.withValues(alpha: 0.15), blurRadius: 12)]
                  : [],
            ),
            child: TextFormField(
              controller: widget.controller,
              obscureText: widget.obscure,
              keyboardType: widget.keyboardType,
              validator: widget.validator,
              style: const TextStyle(
                fontSize: 15,
                color: _textPrimary,
                fontWeight: FontWeight.w500,
              ),
              decoration: InputDecoration(
                hintText: widget.hint,
                hintStyle: const TextStyle(color: _textMuted, fontSize: 14),
                prefixIcon: Icon(
                  widget.prefixIcon,
                  color: _focused ? _goldLight : _textMuted,
                  size: 20,
                ),
                suffixIcon: widget.suffix != null
                    ? Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: widget.suffix,
                      )
                    : null,
                suffixIconConstraints: const BoxConstraints(),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Gold Gradient Button ─────────────────────────────────────────────────────

class _GoldButton extends StatefulWidget {
  final String label;
  final bool isLoading;
  final VoidCallback onTap;
  const _GoldButton({required this.label, required this.isLoading, required this.onTap});

  @override
  State<_GoldButton> createState() => _GoldButtonState();
}

class _GoldButtonState extends State<_GoldButton> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 100));
    _scale = Tween<double>(begin: 1.0, end: 0.97)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) { _ctrl.reverse(); widget.onTap(); },
      onTapCancel: () => _ctrl.reverse(),
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              colors: [Color(0xFFB8862A), Color(0xFFD4A853), Color(0xFFB8862A)],
              stops: [0.0, 0.5, 1.0],
            ),
            boxShadow: [
              BoxShadow(
                color: _goldDark.withValues(alpha: 0.4),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Center(
            child: widget.isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.5,
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Sign In',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

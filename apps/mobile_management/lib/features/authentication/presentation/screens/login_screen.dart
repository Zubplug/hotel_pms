import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/storage/secure_storage_provider.dart';
import '../providers/auth_provider.dart';

// ─── Colour Palette ───────────────────────────────────────────────────────────
const _bgDeep = Color(0xFF070D1A);
const _goldLight = Color(0xFFD4A853);
const _goldDark = Color(0xFF9A7230);
const _cardBg = Color(0xFF111D33);
const _inputBg = Color(0xFF0F1A2E);
const _inputBorder = Color(0xFF1E3A5F);
const _inputFocus = Color(0xFFD4A853);
const _textPrimary = Color(0xFFEEF2FF);
const _textMuted = Color(0xFF6B7FA3);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

enum _RecoveryPurpose { password, pin }

class _RecoveryCodeSheet extends ConsumerStatefulWidget {
  final String initialEmail;

  const _RecoveryCodeSheet({required this.initialEmail});

  @override
  ConsumerState<_RecoveryCodeSheet> createState() => _RecoveryCodeSheetState();
}

class _RecoveryCodeSheetState extends ConsumerState<_RecoveryCodeSheet> {
  late final TextEditingController _emailController;
  final _codeController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  _RecoveryPurpose _purpose = _RecoveryPurpose.password;
  bool _codeSent = false;
  bool _busy = false;
  bool _showNew = false;
  bool _showConfirm = false;
  String? _error;

  String get _purposeValue =>
      _purpose == _RecoveryPurpose.pin ? 'PIN' : 'PASSWORD';
  bool get _isPin => _purpose == _RecoveryPurpose.pin;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final email = _emailController.text.trim();
    if (!email.contains('@')) {
      setState(
        () => _error = 'Enter the email address linked to your account.',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(dioProvider)
          .post(
            '/auth/recovery-code',
            data: {'email': email, 'purpose': _purposeValue},
          );
      if (mounted) setState(() => _codeSent = true);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Unable to send the verification code. Please try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    final code = _codeController.text.trim();
    final next = _newController.text;
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'Enter the six-digit verification code.');
      return;
    }
    if (_isPin ? !RegExp(r'^\d{6}$').hasMatch(next) : next.length < 12) {
      setState(
        () => _error = _isPin
            ? 'PIN must contain exactly 6 digits.'
            : 'Use at least 12 characters for your new password.',
      );
      return;
    }
    if (next != _confirmController.text) {
      setState(
        () => _error = _isPin
            ? 'PIN entries do not match.'
            : 'Passwords do not match.',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(dioProvider)
          .patch(
            '/auth/recovery-code',
            data: {
              'email': _emailController.text.trim(),
              'code': code,
              'purpose': _purposeValue,
              if (_isPin) 'newPin': next else 'newPassword': next,
            },
          );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
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
                    color: _textMuted,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Account recovery',
                style: TextStyle(
                  color: _textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 5),
              const Text(
                'We will send a one-time verification code to your email.',
                style: TextStyle(color: _textMuted, fontSize: 12),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _recoveryChoice(
                      _RecoveryPurpose.password,
                      'Password',
                      Icons.lock_outline_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _recoveryChoice(
                      _RecoveryPurpose.pin,
                      'Login PIN',
                      Icons.pin_outlined,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _recoveryField(
                'ACCOUNT EMAIL',
                _emailController,
                TextInputType.emailAddress,
              ),
              if (_codeSent) ...[
                const SizedBox(height: 14),
                _recoveryField(
                  'VERIFICATION CODE',
                  _codeController,
                  TextInputType.number,
                  maxLength: 6,
                ),
                const SizedBox(height: 14),
                _recoveryField(
                  _isPin ? 'NEW 6-DIGIT PIN' : 'NEW PASSWORD',
                  _newController,
                  _isPin ? TextInputType.number : TextInputType.visiblePassword,
                  obscure: !_showNew,
                  maxLength: _isPin ? 6 : null,
                  toggle: () => setState(() => _showNew = !_showNew),
                ),
                const SizedBox(height: 14),
                _recoveryField(
                  _isPin ? 'CONFIRM PIN' : 'CONFIRM PASSWORD',
                  _confirmController,
                  _isPin ? TextInputType.number : TextInputType.visiblePassword,
                  obscure: !_showConfirm,
                  maxLength: _isPin ? 6 : null,
                  toggle: () => setState(() => _showConfirm = !_showConfirm),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(
                  _error!,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _busy ? null : (_codeSent ? _reset : _sendCode),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _goldLight,
                    foregroundColor: _bgDeep,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: _bgDeep,
                          ),
                        )
                      : Text(
                          _codeSent
                              ? 'Verify and reset'
                              : 'Send verification code',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                ),
              ),
              if (_codeSent)
                Center(
                  child: TextButton(
                    onPressed: _busy ? null : _sendCode,
                    child: const Text(
                      'Resend code',
                      style: TextStyle(color: _goldLight),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _recoveryChoice(
    _RecoveryPurpose purpose,
    String label,
    IconData icon,
  ) {
    final selected = _purpose == purpose;
    return GestureDetector(
      onTap: () => setState(() {
        _purpose = purpose;
        _codeSent = false;
        _error = null;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? _goldLight.withValues(alpha: .13) : _inputBg,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: selected ? _goldLight : _inputBorder),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: selected ? _goldLight : _textMuted, size: 17),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                color: selected ? _goldLight : _textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _recoveryField(
    String label,
    TextEditingController controller,
    TextInputType type, {
    bool obscure = false,
    int? maxLength,
    VoidCallback? toggle,
  }) {
    return TextField(
      controller: controller,
      keyboardType: type,
      obscureText: obscure,
      maxLength: maxLength,
      style: const TextStyle(color: _textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: _textMuted, fontSize: 10),
        counterText: '',
        filled: true,
        fillColor: _inputBg,
        suffixIcon: toggle == null
            ? null
            : IconButton(
                onPressed: toggle,
                icon: Icon(
                  obscure
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: _textMuted,
                  size: 19,
                ),
              ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: const BorderSide(color: _inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: const BorderSide(color: _goldLight),
        ),
      ),
    );
  }
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _isLoading = false;
  bool _rememberMe = false;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _biometricBusy = false;
  bool _usePassword = false;
  String? _errorMessage;
  final _localAuth = LocalAuthentication();

  late final AnimationController _entryCtrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();

    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _fadeAnim = CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic));

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(
      begin: 0.85,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _entryCtrl.forward();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final tokenStorage = ref.read(tokenStorageProvider);
      final email = await tokenStorage.getRememberedEmail();
      final biometricToken = await tokenStorage.getBiometricToken();
      final biometricSignature = await tokenStorage.getBiometricSignature();
      var biometricAvailable = false;
      String? currentBiometricSignature;
      try {
        final biometrics = await _localAuth.getAvailableBiometrics();
        biometricAvailable =
            await _localAuth.isDeviceSupported() &&
            await _localAuth.canCheckBiometrics &&
            biometrics.isNotEmpty;
        if (biometricAvailable) {
          currentBiometricSignature = _signatureFor(biometrics);
        }
      } catch (_) {}
      final biometricConfigured =
          biometricToken != null &&
          biometricToken.isNotEmpty &&
          biometricSignature != null &&
          biometricSignature == currentBiometricSignature;
      if (!biometricConfigured && biometricToken != null) {
        await tokenStorage.clearBiometricToken();
      }
      if (email != null && email.isNotEmpty && mounted) {
        setState(() {
          _emailCtrl.text = email;
          _rememberMe = true;
        });
      }
      if (mounted) {
        setState(() {
          _biometricAvailable = biometricAvailable;
          _biometricEnabled = biometricConfigured;
        });
      }
    });
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
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    HapticFeedback.lightImpact();

    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post(
        '/manager/auth/login',
        data: _usePassword
            ? {'email': _emailCtrl.text.trim(), 'password': _passCtrl.text}
            : {'identifier': _emailCtrl.text.trim(), 'pin': _passCtrl.text},
      );

      if (res.statusCode == 200) {
        final token = res.data['data']['token'] as String?;
        if (token != null) {
          HapticFeedback.mediumImpact();
          final tokenStorage = ref.read(tokenStorageProvider);
          if (_rememberMe) {
            await tokenStorage.saveRememberedEmail(_emailCtrl.text.trim());
          } else {
            await tokenStorage.clearRememberedEmail();
          }
          var keepBiometricEnabled = _biometricAvailable && _biometricEnabled;
          if (_usePassword && _biometricAvailable && !_biometricEnabled) {
            final enroll = await _offerBiometricEnrollment();
            keepBiometricEnabled = enroll;
            if (mounted) setState(() => _biometricEnabled = enroll);
          }
          if (keepBiometricEnabled) {
            final prepared = await _prepareBiometricToken(token);
            if (!prepared && mounted) {
              setState(() => _biometricEnabled = false);
            }
          } else {
            await tokenStorage.clearBiometricToken();
          }
          if (_usePassword) {
            await tokenStorage.saveTokens(accessToken: token, refreshToken: '');
            await _offerPinSetup(_passCtrl.text);
          }
          await ref.read(authProvider.notifier).login(token);
        }
      }
    } catch (e) {
      HapticFeedback.heavyImpact();
      String errorMsg = 'An unexpected error occurred. Please try again.';

      if (e.runtimeType.toString().contains('DioException')) {
        final dynamic dioError = e;
        final statusCode = dioError.response?.statusCode;
        final data = dioError.response?.data;

        if (statusCode == 409) {
          errorMsg =
              'Mobile PIN is not set up. Sign in with your password first.';
          setState(() => _usePassword = true);
        } else if (statusCode == 429) {
          errorMsg =
              'Too many PIN attempts. Try again later or use your password.';
        } else if (statusCode == 401 || statusCode == 403) {
          errorMsg = 'Invalid email or password. Please try again.';
        } else if (data != null && data is Map && data['message'] != null) {
          errorMsg = data['message'].toString();
        } else if (statusCode != null) {
          errorMsg = 'Server error ($statusCode). Please try again later.';
        } else {
          errorMsg = 'Network error. Please check your connection.';
        }
      } else {
        errorMsg = 'An unexpected error occurred.';
      }
      debugPrint('LOGIN ERROR: $e');
      setState(() => _errorMessage = errorMsg);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _offerPinSetup(String currentPassword) async {
    final pin = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => const _PinSetupDialog(),
    );
    if (pin == null || !mounted) return;

    try {
      await ref
          .read(dioProvider)
          .post(
            '/manager/auth/pin/setup',
            data: {'pin': pin, 'currentPassword': currentPassword},
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Mobile PIN enabled for faster sign in.'),
          ),
        );
      }
    } catch (_) {
      // Password login remains successful if PIN enrollment is skipped or fails.
    }
  }

  Future<bool> _offerBiometricEnrollment() async {
    final enabled = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: _cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: const Row(
          children: [
            Icon(Icons.fingerprint_rounded, color: _goldLight, size: 24),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Enable biometric sign in',
                style: TextStyle(color: _textPrimary, fontSize: 18),
              ),
            ),
          ],
        ),
        content: const Text(
          'Use Face ID or your fingerprint for faster, secure access to LodgeCore. Your password is never stored on this device.',
          style: TextStyle(color: _textMuted, height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Not now', style: TextStyle(color: _textMuted)),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: _goldLight,
              foregroundColor: _bgDeep,
            ),
            child: const Text('Enable'),
          ),
        ],
      ),
    );
    return enabled == true;
  }

  Future<void> _showRecoverySheet() async {
    final reset = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RecoveryCodeSheet(initialEmail: _emailCtrl.text.trim()),
    );
    if (reset == true && mounted) {
      await ref.read(tokenStorageProvider).clearBiometricToken();
      setState(
        () => _errorMessage =
            'Reset complete. Sign in with your new credentials.',
      );
    }
  }

  Future<void> _handleBiometricLogin() async {
    final tokenStorage = ref.read(tokenStorageProvider);
    final token = await tokenStorage.getBiometricToken();
    final storedSignature = await tokenStorage.getBiometricSignature();
    String? currentSignature;
    try {
      currentSignature = _signatureFor(
        await _localAuth.getAvailableBiometrics(),
      );
    } catch (_) {}
    if (token == null || token.isEmpty) {
      setState(
        () => _errorMessage =
            'Sign in with your password once to enable biometric access.',
      );
      return;
    }
    if (storedSignature == null || storedSignature != currentSignature) {
      await tokenStorage.clearBiometricToken();
      if (mounted) {
        setState(() {
          _biometricEnabled = false;
          _errorMessage =
              'Biometric access was reset. Sign in with your password to enable it again.';
        });
      }
      return;
    }

    setState(() {
      _biometricBusy = true;
      _errorMessage = null;
    });
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Verify your identity to access LodgeCore',
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
      if (authenticated) {
        final tokenStorage = ref.read(tokenStorageProvider);
        await tokenStorage.saveTokens(accessToken: token, refreshToken: '');
        try {
          await ref.read(dioProvider).get('/mobile/v1/me');
          await ref.read(authProvider.notifier).login(token);
        } catch (_) {
          await tokenStorage.clearTokens();
          await tokenStorage.clearBiometricToken();
          if (mounted) {
            setState(() {
              _biometricEnabled = false;
              _errorMessage =
                  'Your biometric session has expired. Sign in with your password to enable it again.';
            });
          }
        }
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _errorMessage = 'Biometric verification was not completed.',
        );
      }
    } finally {
      if (mounted) setState(() => _biometricBusy = false);
    }
  }

  String _signatureFor(List<BiometricType> biometrics) {
    final names = biometrics.map((biometric) => biometric.name).toList()
      ..sort();
    return names.join('|');
  }

  Future<bool> _prepareBiometricToken(String token) async {
    final tokenStorage = ref.read(tokenStorageProvider);
    final existingToken = await tokenStorage.getBiometricToken();
    final existingSignature = await tokenStorage.getBiometricSignature();
    final currentSignature = _signatureFor(
      await _localAuth.getAvailableBiometrics(),
    );
    if (existingToken != null &&
        existingToken.isNotEmpty &&
        existingSignature == currentSignature) {
      await tokenStorage.saveBiometricToken(token);
      return true;
    }

    final authenticated = await _localAuth.authenticate(
      localizedReason:
          'Confirm your identity to enable LodgeCore biometric sign in',
      biometricOnly: true,
      persistAcrossBackgrounding: true,
    );
    if (!authenticated) {
      await tokenStorage.clearBiometricToken();
      return false;
    }
    await tokenStorage.saveBiometricToken(token);
    await tokenStorage.saveBiometricSignature(currentSignature);
    return true;
  }

  Widget _buildEnterpriseLogin(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bgDeep,
        body: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_bgDeep, const Color(0xFF0B1426), _bgDeep],
                  ),
                ),
              ),
            ),
            Positioned(
              top: -180,
              left: -130,
              child: _GlowBlob(color: const Color(0xFF244D79), size: 460),
            ),
            Positioned(
              bottom: -220,
              right: -170,
              child: _GlowBlob(color: const Color(0xFF60421C), size: 520),
            ),
            SafeArea(
              child: FadeTransition(
                opacity: _fadeAnim,
                child: SlideTransition(
                  position: _slideAnim,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final isWide = constraints.maxWidth >= 760;
                      final isShort = constraints.maxHeight < 700;
                      final content = isWide
                          ? Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Expanded(child: _buildBrandPanel()),
                                const SizedBox(width: 72),
                                SizedBox(
                                  width: 430,
                                  child: _buildCredentialPanel(),
                                ),
                              ],
                            )
                          : Column(
                              children: [
                                _buildBrandPanel(compact: true, dense: isShort),
                                SizedBox(height: isShort ? 14 : 34),
                                _buildCredentialPanel(dense: isShort),
                              ],
                            );

                      return SingleChildScrollView(
                        padding: EdgeInsets.symmetric(
                          horizontal: isWide ? 72 : 24,
                          vertical: isWide ? 56 : (isShort ? 10 : 28),
                        ),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight:
                                constraints.maxHeight - (isWide ? 112 : 56),
                          ),
                          child: content,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                height: 2,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      _goldDark,
                      _goldLight,
                      _goldDark,
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrandPanel({bool compact = false, bool dense = false}) {
    return Column(
      crossAxisAlignment: compact
          ? CrossAxisAlignment.center
          : CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max,
          children: [
            Container(
              width: compact && dense ? 40 : 50,
              height: compact && dense ? 40 : 50,
              decoration: BoxDecoration(
                color: _goldLight.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _goldLight.withValues(alpha: 0.5)),
              ),
              child: Icon(
                Icons.apartment_rounded,
                color: _goldLight,
                size: compact && dense ? 21 : 25,
              ),
            ),
            const SizedBox(width: 14),
            Text(
              'LODGECORE',
              style: TextStyle(
                color: _textPrimary,
                fontSize: compact && dense ? 16 : 18,
                fontWeight: FontWeight.w800,
                letterSpacing: 2.2,
              ),
            ),
          ],
        ),
        SizedBox(height: compact ? (dense ? 12 : 26) : 48),
        Text(
          compact ? 'Welcome back.' : 'Your property,\nunder control.',
          textAlign: compact ? TextAlign.center : TextAlign.left,
          style: TextStyle(
            color: _textPrimary,
            fontSize: compact ? (dense ? 27 : 34) : 54,
            height: 1.02,
            fontWeight: FontWeight.w800,
            letterSpacing: -1.8,
          ),
        ),
        SizedBox(height: compact && dense ? 8 : 18),
        SizedBox(
          width: compact ? 360 : 440,
          child: Text(
            compact
                ? 'Sign in to continue to your hotel operations workspace.'
                : 'A secure command centre for the people who keep every stay moving.',
            textAlign: compact ? TextAlign.center : TextAlign.left,
            style: TextStyle(
              color: _textMuted,
              fontSize: compact && dense ? 12 : 16,
              height: compact && dense ? 1.25 : 1.55,
            ),
          ),
        ),
        if (!compact) ...[
          const SizedBox(height: 44),
          Row(
            children: const [
              _TrustItem(
                icon: Icons.shield_outlined,
                label: 'Protected access',
              ),
              SizedBox(width: 24),
              _TrustItem(
                icon: Icons.cloud_done_outlined,
                label: 'Live operations',
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildCredentialPanel({bool dense = false}) {
    final fieldGap = dense ? 10.0 : 18.0;
    final sectionGap = dense ? 14.0 : 26.0;

    return Form(
      key: _formKey,
      child: Container(
        padding: EdgeInsets.all(dense ? 16 : 28),
        decoration: BoxDecoration(
          color: _cardBg.withValues(alpha: 0.88),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: Colors.white.withValues(alpha: 0.09)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.32),
              blurRadius: 38,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Secure sign in',
                    style: TextStyle(
                      color: _textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16352F),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.lock_outline_rounded,
                        color: Color(0xFF7DE0AF),
                        size: 13,
                      ),
                      SizedBox(width: 5),
                      Text(
                        'PRIVATE',
                        style: TextStyle(
                          color: Color(0xFF9DE8C0),
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: dense ? 3 : 7),
            const Text(
              'Use your staff credentials to continue.',
              style: TextStyle(color: _textMuted, fontSize: 13),
            ),
            SizedBox(height: sectionGap),
            _PremiumField(
              controller: _emailCtrl,
              label: _usePassword ? 'WORK EMAIL' : 'EMAIL OR PHONE',
              hint: _usePassword ? 'name@hotel.com' : 'name@hotel.com or 080…',
              prefixIcon: Icons.mail_outline_rounded,
              keyboardType: _usePassword
                  ? TextInputType.emailAddress
                  : TextInputType.text,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? 'Enter your email or phone number'
                  : null,
            ),
            SizedBox(height: fieldGap),
            _PremiumField(
              controller: _passCtrl,
              label: _usePassword ? 'PASSWORD' : '6-DIGIT LOGIN PIN',
              hint: _usePassword ? 'Enter your password' : '••••••',
              prefixIcon: _usePassword
                  ? Icons.key_rounded
                  : Icons.dialpad_rounded,
              obscure: true,
              keyboardType: _usePassword
                  ? TextInputType.text
                  : TextInputType.number,
              validator: (v) => _usePassword
                  ? ((v == null || v.length < 4) ? 'Enter your password' : null)
                  : ((v == null || !RegExp(r'^\d{6}$').hasMatch(v))
                        ? 'Enter your 6-digit PIN'
                        : null),
              suffix: _usePassword
                  ? GestureDetector(
                      onTap: () => setState(() => _obscure = !_obscure),
                      child: Icon(
                        _obscure
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: _textMuted,
                        size: 20,
                      ),
                    )
                  : null,
            ),
            SizedBox(height: dense ? 6 : 14),
            Row(
              children: [
                SizedBox(
                  width: 22,
                  height: 22,
                  child: Checkbox(
                    value: _rememberMe,
                    onChanged: (value) =>
                        setState(() => _rememberMe = value ?? false),
                    activeColor: _goldLight,
                    checkColor: _bgDeep,
                    side: const BorderSide(color: _inputBorder),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _usePassword ? 'Remember this email' : 'Use your staff PIN',
                  style: TextStyle(color: _textMuted, fontSize: 12),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() {
                    _usePassword = !_usePassword;
                    _passCtrl.clear();
                    _errorMessage = null;
                  }),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    _usePassword ? 'Use PIN instead' : 'Use password instead',
                    style: TextStyle(
                      color: _goldLight,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            if (_biometricAvailable) ...[
              SizedBox(height: dense ? 8 : 16),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: _inputBg,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _inputBorder.withValues(alpha: 0.7),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.fingerprint_rounded,
                      color: _goldLight,
                      size: 20,
                    ),
                    const SizedBox(width: 9),
                    const Expanded(
                      child: Text(
                        'Enable biometric sign in',
                        style: TextStyle(
                          color: _textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Switch.adaptive(
                      value: _biometricEnabled,
                      onChanged: (value) async {
                        setState(() => _biometricEnabled = value);
                        if (!value) {
                          await ref
                              .read(tokenStorageProvider)
                              .clearBiometricToken();
                        }
                      },
                      activeThumbColor: _goldLight,
                    ),
                  ],
                ),
              ),
            ],
            if (_errorMessage != null) ...[
              SizedBox(height: dense ? 8 : 16),
              _ErrorBanner(message: _errorMessage!),
            ],
            SizedBox(height: dense ? 12 : 22),
            _GoldButton(
              label: 'Continue to workspace',
              isLoading: _isLoading,
              onTap: _handleLogin,
            ),
            if (_biometricAvailable && _biometricEnabled) ...[
              SizedBox(height: dense ? 8 : 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _biometricBusy ? null : _handleBiometricLogin,
                  icon: _biometricBusy
                      ? const SizedBox(
                          width: 17,
                          height: 17,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: _goldLight,
                          ),
                        )
                      : const Icon(Icons.fingerprint_rounded, size: 20),
                  label: const Text('Use biometrics instead'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _goldLight,
                    side: BorderSide(color: _goldDark.withValues(alpha: 0.8)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ],
            SizedBox(height: dense ? 10 : 22),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.info_outline_rounded, color: _textMuted, size: 14),
                SizedBox(width: 6),
                Text(
                  'Access is monitored for your protection',
                  style: TextStyle(color: _textMuted, fontSize: 10.5),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _buildEnterpriseLogin(context);
    // Legacy layout retained below temporarily for safe rollback during QA.
    // ignore: dead_code
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bgDeep,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            // ── Ambient glow top-left ──
            Positioned(
              top: -80,
              left: -80,
              child: _GlowBlob(color: const Color(0xFF1A3A6B), size: 320),
            ),
            // ── Ambient glow bottom-right ──
            Positioned(
              bottom: -100,
              right: -80,
              child: _GlowBlob(color: const Color(0xFF2A1A0A), size: 380),
            ),
            // ── Subtle gold accent line top ──
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                height: 2,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      _goldDark,
                      _goldLight,
                      _goldDark,
                      Colors.transparent,
                    ],
                  ),
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
                                          color: _goldDark.withValues(
                                            alpha: 0.6,
                                          ),
                                          width: 1.5,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: _goldDark.withValues(
                                              alpha: 0.2,
                                            ),
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
                                          color: Colors.black.withValues(
                                            alpha: 0.5,
                                          ),
                                          blurRadius: 40,
                                          offset: const Offset(0, 16),
                                        ),
                                      ],
                                    ),
                                    padding: const EdgeInsets.all(28),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
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
                                          prefixIcon:
                                              Icons.alternate_email_rounded,
                                          keyboardType:
                                              TextInputType.emailAddress,
                                          validator: (v) =>
                                              (v == null || !v.contains('@'))
                                              ? 'Enter a valid email'
                                              : null,
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
                                              (v == null || v.length < 4)
                                              ? 'Enter your password'
                                              : null,
                                          suffix: GestureDetector(
                                            onTap: () => setState(
                                              () => _obscure = !_obscure,
                                            ),
                                            child: Icon(
                                              _obscure
                                                  ? Icons
                                                        .visibility_off_outlined
                                                  : Icons.visibility_outlined,
                                              color: _textMuted,
                                              size: 20,
                                            ),
                                          ),
                                        ),

                                        const SizedBox(height: 12),

                                        // Remember me and Forgot password
                                        Row(
                                          children: [
                                            SizedBox(
                                              height: 24,
                                              width: 24,
                                              child: Checkbox(
                                                value: _rememberMe,
                                                onChanged: (v) => setState(
                                                  () =>
                                                      _rememberMe = v ?? false,
                                                ),
                                                activeColor: _goldLight,
                                                checkColor: _bgDeep,
                                                side: const BorderSide(
                                                  color: _inputBorder,
                                                  width: 1.5,
                                                ),
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(6),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            const Text(
                                              'Remember me',
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: _textMuted,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                            const Spacer(),
                                            GestureDetector(
                                              onTap: _showRecoverySheet,
                                              child: const Text(
                                                'Forgot password or PIN?',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  color: _goldLight,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),

                                        const SizedBox(height: 28),

                                        if (_biometricAvailable) ...[
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 14,
                                              vertical: 10,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _goldLight.withValues(
                                                alpha: 0.07,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(14),
                                              border: Border.all(
                                                color: _goldLight.withValues(
                                                  alpha: 0.16,
                                                ),
                                              ),
                                            ),
                                            child: Row(
                                              children: [
                                                const Icon(
                                                  Icons.verified_user_outlined,
                                                  color: _goldLight,
                                                  size: 18,
                                                ),
                                                const SizedBox(width: 10),
                                                const Expanded(
                                                  child: Text(
                                                    'Use device biometrics next time',
                                                    style: TextStyle(
                                                      color: _textPrimary,
                                                      fontSize: 12.5,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                ),
                                                Switch.adaptive(
                                                  value: _biometricEnabled,
                                                  onChanged: (value) async {
                                                    setState(
                                                      () => _biometricEnabled =
                                                          value,
                                                    );
                                                    if (!value) {
                                                      await ref
                                                          .read(
                                                            tokenStorageProvider,
                                                          )
                                                          .clearBiometricToken();
                                                    }
                                                  },
                                                  activeThumbColor: _goldLight,
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(height: 18),
                                        ],

                                        // Error message
                                        if (_errorMessage != null) ...[
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 14,
                                              vertical: 12,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.red.withValues(
                                                alpha: 0.08,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                              border: Border.all(
                                                color: Colors.red.withValues(
                                                  alpha: 0.3,
                                                ),
                                              ),
                                            ),
                                            child: Row(
                                              children: [
                                                const Icon(
                                                  Icons.error_outline,
                                                  color: Colors.redAccent,
                                                  size: 16,
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Text(
                                                    _errorMessage!,
                                                    style: const TextStyle(
                                                      color: Colors.redAccent,
                                                      fontSize: 13,
                                                    ),
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
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Divider(
                                          color: _inputBorder.withValues(
                                            alpha: 0.5,
                                          ),
                                        ),
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 16,
                                        ),
                                        child: Text(
                                          'or continue with',
                                          style: TextStyle(
                                            color: _textMuted,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: Divider(
                                          color: _inputBorder.withValues(
                                            alpha: 0.5,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),

                                  const SizedBox(height: 24),

                                  // ── Biometric ──────────────────────────────────
                                  GestureDetector(
                                    onTap: _biometricBusy
                                        ? null
                                        : _handleBiometricLogin,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 32,
                                        vertical: 16,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _cardBg,
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(color: _inputBorder),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          _biometricBusy
                                              ? const SizedBox(
                                                  width: 28,
                                                  height: 28,
                                                  child:
                                                      CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                        color: _goldLight,
                                                      ),
                                                )
                                              : Icon(
                                                  Icons.fingerprint_rounded,
                                                  color: _goldLight,
                                                  size: 28,
                                                ),
                                          const SizedBox(width: 12),
                                          Text(
                                            _biometricAvailable
                                                ? 'Sign in with biometrics'
                                                : 'Biometric Login',
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
                                    style: const TextStyle(
                                      color: _textMuted,
                                      fontSize: 11,
                                    ),
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

class _TrustItem extends StatelessWidget {
  final IconData icon;
  final String label;

  const _TrustItem({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: _goldLight, size: 18),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: _textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _PinSetupDialog extends StatefulWidget {
  const _PinSetupDialog();

  @override
  State<_PinSetupDialog> createState() => _PinSetupDialogState();
}

class _PinSetupDialogState extends State<_PinSetupDialog> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();
  final _pinFocus = FocusNode();
  final _confirmFocus = FocusNode();
  String? _error;

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    _pinFocus.dispose();
    _confirmFocus.dispose();
    super.dispose();
  }

  void _submit() {
    final pin = _pinController.text;
    if (!RegExp(r'^\d{6}$').hasMatch(pin)) {
      setState(() => _error = 'PIN must contain exactly 6 digits.');
      return;
    }
    if (pin != _confirmController.text) {
      setState(() => _error = 'PIN entries do not match.');
      return;
    }
    Navigator.of(context).pop(pin);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 430),
        child: SingleChildScrollView(
          child: Container(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
            decoration: BoxDecoration(
              color: _cardBg,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: _goldLight.withValues(alpha: .28)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x66000000),
                  blurRadius: 32,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: _goldLight.withValues(alpha: .12),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: _goldLight.withValues(alpha: .3),
                        ),
                      ),
                      child: const Icon(
                        Icons.lock_person_outlined,
                        color: _goldLight,
                        size: 25,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Secure your access',
                            style: TextStyle(
                              color: _textPrimary,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -.3,
                            ),
                          ),
                          SizedBox(height: 5),
                          Text(
                            'Set a private PIN for faster sign in.',
                            style: TextStyle(
                              color: _textMuted,
                              fontSize: 13,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(
                        Icons.close,
                        color: _textMuted,
                        size: 20,
                      ),
                      tooltip: 'Set up later',
                    ),
                  ],
                ),
                const SizedBox(height: 22),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: const Color(0xFF17243A),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.verified_user_outlined,
                        color: _goldLight,
                        size: 18,
                      ),
                      SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          'Your PIN is protected by the LodgeCore security layer.',
                          style: TextStyle(
                            color: _textMuted,
                            fontSize: 12,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                _pinInput(
                  controller: _pinController,
                  focusNode: _pinFocus,
                  label: 'Create PIN',
                  hint: '6 digits',
                  onSubmitted: (_) => _confirmFocus.requestFocus(),
                ),
                const SizedBox(height: 12),
                _pinInput(
                  controller: _confirmController,
                  focusNode: _confirmFocus,
                  label: 'Confirm PIN',
                  hint: 'Repeat your PIN',
                  onSubmitted: (_) => _submit(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3A1D25),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF8D3D4D)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.error_outline,
                          color: Colors.redAccent,
                          size: 17,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              color: Colors.redAccent,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: _textMuted,
                          side: const BorderSide(color: Color(0xFF34445E)),
                          minimumSize: const Size.fromHeight(48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text('Later'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                        onPressed: _submit,
                        icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                        label: const Text('Enable PIN'),
                        style: FilledButton.styleFrom(
                          backgroundColor: _goldLight,
                          foregroundColor: _bgDeep,
                          minimumSize: const Size.fromHeight(48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _pinInput({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required ValueChanged<String> onSubmitted,
  }) {
    return TextField(
      controller: controller,
      focusNode: focusNode,
      autofocus: label == 'Create PIN',
      obscureText: true,
      keyboardType: TextInputType.number,
      textInputAction: label == 'Create PIN'
          ? TextInputAction.next
          : TextInputAction.done,
      maxLength: 6,
      onChanged: (_) => setState(() => _error = null),
      onSubmitted: onSubmitted,
      style: const TextStyle(
        color: _textPrimary,
        fontSize: 19,
        letterSpacing: 8,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        counterText: '',
        prefixIcon: const Icon(
          Icons.dialpad_rounded,
          color: _textMuted,
          size: 20,
        ),
        filled: true,
        fillColor: const Color(0xFF111C2E),
        labelStyle: const TextStyle(color: _textMuted, fontSize: 13),
        hintStyle: const TextStyle(color: Color(0xFF53627A), fontSize: 13),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 16,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFF2D3C55)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: _goldLight, width: 1.4),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;

  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: const Color(0xFF3A1D25),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF8D3D4D)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: Color(0xFFFF9AAB),
            size: 17,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFFFFC4CD), fontSize: 12.5),
            ),
          ),
        ],
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
        gradient: RadialGradient(
          colors: [color.withValues(alpha: 0.45), color.withValues(alpha: 0)],
        ),
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
                  ? [
                      BoxShadow(
                        color: _goldDark.withValues(alpha: 0.15),
                        blurRadius: 12,
                      ),
                    ]
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
  const _GoldButton({
    required this.label,
    required this.isLoading,
    required this.onTap,
  });

  @override
  State<_GoldButton> createState() => _GoldButtonState();
}

class _GoldButtonState extends State<_GoldButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scale = Tween<double>(
      begin: 1.0,
      end: 0.97,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) {
        _ctrl.reverse();
        widget.onTap();
      },
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
                      const Icon(
                        Icons.arrow_forward_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

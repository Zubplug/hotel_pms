import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/services/fcm_service.dart';
import 'features/authentication/presentation/providers/auth_provider.dart';

/// Must be a top-level function — FCM requires it for background messages.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background messages delivered by FCM when app is backgrounded/killed.
  // On foreground resume, WebSocket reconnect will trigger data refresh.
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('[LodgeCore] Flutter error: ${details.exception}');
    debugPrintStack(stackTrace: details.stack);
  };

  ui.PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[LodgeCore] Unhandled error: $error');
    debugPrintStack(stackTrace: stack);
    return true;
  };

  // Flutter's default release ErrorWidget is only an icon on a blank screen.
  // Keep startup failures visible and actionable for users and support staff.
  ErrorWidget.builder = (details) =>
      _AppErrorWidget(message: details.exceptionAsString());

  // Firebase is only active when GoogleService-Info.plist (iOS) /
  // google-services.json (Android) are present in the project.
  // Without them the app still runs; FCM push is simply disabled.
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  } catch (_) {
    // Firebase config not yet added — FCM disabled, all other features work.
    debugPrint(
      '[LodgeCore] Firebase not configured — push notifications disabled.',
    );
  }

  await runZonedGuarded(
    () async => runApp(const ProviderScope(child: LodgeCoreManagerApp())),
    (error, stack) {
      debugPrint('[LodgeCore] Zone error: $error');
      debugPrintStack(stackTrace: stack);
    },
  );
}

class _AppErrorWidget extends StatelessWidget {
  final String message;

  const _AppErrorWidget({required this.message});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF070D1A),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  color: Color(0xFFD6A956),
                  size: 56,
                ),
                const SizedBox(height: 18),
                const Text(
                  'LodgeCore could not start',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Please close and reopen the app. If the problem continues, contact support.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF94A3B8), height: 1.4),
                ),
                if (const bool.fromEnvironment('dart.vm.product') == false) ...[
                  const SizedBox(height: 18),
                  SelectableText(
                    message,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class LodgeCoreManagerApp extends ConsumerStatefulWidget {
  const LodgeCoreManagerApp({super.key});

  @override
  ConsumerState<LodgeCoreManagerApp> createState() =>
      _LodgeCoreManagerAppState();
}

class _LodgeCoreManagerAppState extends ConsumerState<LodgeCoreManagerApp> {
  @override
  void initState() {
    super.initState();
    // Listen to auth state — initialize FCM when the user logs in
    ref.listenManual(authProvider, (previous, next) {
      if (next == AuthStatus.authenticated &&
          previous != AuthStatus.authenticated) {
        ref.read(fcmServiceProvider).initialize();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final theme = ref.watch(appThemeProvider);

    return MaterialApp.router(
      title: 'LodgeCore Manager',
      theme: theme.lightTheme,
      darkTheme: theme.darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}

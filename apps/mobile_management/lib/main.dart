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

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase is only active when GoogleService-Info.plist (iOS) /
  // google-services.json (Android) are present in the project.
  // Without them the app still runs; FCM push is simply disabled.
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  } catch (_) {
    // Firebase config not yet added — FCM disabled, all other features work.
    debugPrint('[LodgeCore] Firebase not configured — push notifications disabled.');
  }

  runApp(
    const ProviderScope(
      child: LodgeCoreManagerApp(),
    ),
  );
}

class LodgeCoreManagerApp extends ConsumerStatefulWidget {
  const LodgeCoreManagerApp({super.key});

  @override
  ConsumerState<LodgeCoreManagerApp> createState() => _LodgeCoreManagerAppState();
}

class _LodgeCoreManagerAppState extends ConsumerState<LodgeCoreManagerApp> {
  @override
  void initState() {
    super.initState();
    // Listen to auth state — initialize FCM when the user logs in
    ref.listenManual(authProvider, (previous, next) {
      if (next == AuthStatus.authenticated && previous != AuthStatus.authenticated) {
        ref.read(fcmServiceProvider).initialize();
      } else if (next == AuthStatus.unauthenticated && previous == AuthStatus.authenticated) {
        ref.read(fcmServiceProvider).unregisterToken();
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

// App-wide configuration constants.
// In a CI/CD pipeline, switch between flavors using --dart-define.

class AppConfig {
  /// Base URL for all API calls.
  /// Override at build time: flutter run --dart-define=API_BASE_URL=https://your-domain.com/api
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://hotel-pms-web-nine.vercel.app/api',
  );

  /// WebSocket endpoint for real-time events.
  static const String wsUrl = String.fromEnvironment(
    'WS_URL',
    defaultValue: 'wss://hotel-pms-web-nine.vercel.app/api/ws',
  );
}

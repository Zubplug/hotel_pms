import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/app_config.dart';
import '../storage/secure_storage_provider.dart';

/// Events broadcast over the WebSocket that the Manager App cares about.
enum WsEventType { approvalCreated, approvalUpdated, unknown }

class WsEvent {
  final WsEventType type;
  final Map<String, dynamic> payload;
  WsEvent(this.type, this.payload);
}

class WebSocketService {
  final TokenStorage _tokenStorage;

  WebSocketChannel? _channel;
  StreamController<WsEvent>? _controller;
  Timer? _reconnectTimer;
  bool _disposed = false;

  Stream<WsEvent> get events => _controller!.stream;

  WebSocketService(this._tokenStorage) {
    _controller = StreamController<WsEvent>.broadcast();
    _connect();
  }

  Future<void> _connect() async {
    if (_disposed) return;
    final token = await _tokenStorage.getAccessToken();
    if (token == null) return;

    try {
      final configuredUri = Uri.parse(AppConfig.wsUrl);
      final scheme = configuredUri.scheme == 'https'
          ? 'wss'
          : configuredUri.scheme == 'http'
          ? 'ws'
          : configuredUri.scheme;
      final uri = Uri(
        scheme: scheme,
        userInfo: configuredUri.userInfo,
        host: configuredUri.host,
        // A port of zero can be injected by a local build configuration. It
        // is not a valid production WebSocket port, so let the URI use the
        // standard port for ws/wss instead.
        port: configuredUri.port == 0 ? null : configuredUri.port,
        path: configuredUri.path,
        queryParameters: {...configuredUri.queryParameters, 'token': token},
        fragment: configuredUri.fragment,
      );
      _channel = WebSocketChannel.connect(uri);
      // The handshake can fail asynchronously after connect() returns. Await
      // it inside this guarded block so a bad endpoint never becomes an
      // unhandled WebSocketChannelException in the Flutter runtime.
      await _channel!.ready;

      _channel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message as String) as Map<String, dynamic>;
            final eventType = _parseEventType(data['type'] as String? ?? '');
            _controller!.add(
              WsEvent(
                eventType,
                data['payload'] as Map<String, dynamic>? ?? {},
              ),
            );
          } catch (_) {}
        },
        onDone: _scheduleReconnect,
        onError: (Object error, StackTrace stackTrace) {
          // Realtime updates are optional; a failed socket must not crash the
          // dashboard or surface as an unhandled asynchronous exception.
          _scheduleReconnect();
        },
        cancelOnError: true,
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  WsEventType _parseEventType(String type) {
    switch (type) {
      case 'APPROVAL_CREATED':
        return WsEventType.approvalCreated;
      case 'APPROVAL_UPDATED':
        return WsEventType.approvalUpdated;
      default:
        return WsEventType.unknown;
    }
  }

  void _scheduleReconnect() {
    if (_disposed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), _connect);
  }

  void dispose() {
    _disposed = true;
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _controller?.close();
  }
}

final webSocketServiceProvider = Provider<WebSocketService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final service = WebSocketService(tokenStorage);
  ref.onDispose(service.dispose);
  return service;
});

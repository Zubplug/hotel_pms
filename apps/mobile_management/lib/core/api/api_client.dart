import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage_provider.dart';
import '../config/app_config.dart';
import '../../features/authentication/presentation/providers/auth_provider.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );

  final tokenStorage = ref.watch(tokenStorageProvider);

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final accessToken = await tokenStorage.getAccessToken();
        if (accessToken != null && accessToken.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $accessToken';
        }
        if (kDebugMode) {
          debugPrint('[LodgeCore API] ${options.method} ${options.uri}');
        }
        return handler.next(options);
      },
      onResponse: (response, handler) {
        if (kDebugMode) {
          debugPrint(
            '[LodgeCore API] ${response.statusCode} ${response.requestOptions.uri}',
          );
        }
        return handler.next(response);
      },
      onError: (DioException e, handler) async {
        if (kDebugMode) {
          debugPrint(
            '[LodgeCore API ERROR] ${e.response?.statusCode ?? 'NETWORK'} '
            '${e.requestOptions.method} ${e.requestOptions.uri}',
          );
          debugPrint('[LodgeCore API ERROR] ${e.message}');
          if (e.response?.data != null) {
            debugPrint('[LodgeCore API ERROR BODY] ${e.response?.data}');
          }
        }
        // A 401 means the access token is no longer accepted. Clear the local
        // session so the router returns to login instead of leaving the user
        // on a dashboard error screen. Permission/property issues should use
        // 403 and are not treated as session expiry.
        if (e.response?.statusCode == 401) {
          // Do not await this inside Dio's error pipeline. Clearing the local
          // session updates the router immediately and avoids another API
          // request while the token is already known to be invalid.
          unawaited(ref.read(authProvider.notifier).expireSession());
        }
        return handler.next(e);
      },
    ),
  );

  return dio;
});

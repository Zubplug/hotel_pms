import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/api/api_client.dart';
import '../presentation/models/user_profile.dart';

class ProfileRepository {
  final Dio _dio;

  ProfileRepository(this._dio);

  Future<UserProfileData> getProfile() async {
    try {
      final response = await _dio.get('/mobile/v1/me');
      
      if (response.data != null && response.data['data'] != null) {
        return UserProfileData.fromJson(response.data['data']);
      }
      throw Exception('Invalid profile response format');
    } on DioException catch (e) {
      if (e.response?.data != null && e.response?.data is Map) {
        final data = e.response!.data;
        if (data['error'] != null && data['error']['message'] != null) {
          throw Exception(data['error']['message']);
        }
        if (data['message'] != null) {
          throw Exception(data['message']);
        }
      }
      throw Exception(e.message ?? 'Failed to load profile');
    }
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return ProfileRepository(dio);
});

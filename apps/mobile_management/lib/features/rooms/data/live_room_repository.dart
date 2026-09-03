import 'dart:convert';
import 'package:http/http.dart' as http;
import 'room_models.dart';
import '../../../core/api/api_client.dart';

class LiveRoomRepository {
  final ApiClient _apiClient; // Assuming standard authenticated client wrapper

  LiveRoomRepository(this._apiClient);

  Future<ExecutiveRoomsData> getExecutiveRooms() async {
    final response = await _apiClient.get('/mobile/v1/executive/rooms');
    
    if (response.statusCode == 200) {
      final jsonMap = jsonDecode(response.body);
      if (jsonMap['success'] == true) {
        return ExecutiveRoomsData.fromJson(jsonMap['data']);
      } else {
        throw Exception(jsonMap['error'] ?? 'Failed to load rooms');
      }
    } else {
      throw Exception('Failed to fetch executive rooms: ${response.statusCode}');
    }
  }

  Future<RoomDetailsData> getRoomDetails(String roomId) async {
    final response = await _apiClient.get('/mobile/v1/executive/rooms/$roomId');
    
    if (response.statusCode == 200) {
      final jsonMap = jsonDecode(response.body);
      if (jsonMap['success'] == true) {
        return RoomDetailsData.fromJson(jsonMap['data']);
      } else {
        throw Exception(jsonMap['error'] ?? 'Failed to load room details');
      }
    } else {
      throw Exception('Failed to fetch room details: ${response.statusCode}');
    }
  }
}

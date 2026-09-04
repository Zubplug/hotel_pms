import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  try {
    final loginRes = await http.post(
      Uri.parse('https://lodgecore.vercel.app/api/manager/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': 'ododarlington@yahoo.com',
        'password': 'Darlington2026@.'
      }),
    );
    final loginData = jsonDecode(loginRes.body);
    final token = loginData['data']['accessToken'];
    print("Logged in!");

    final profileRes = await http.get(
      Uri.parse('https://lodgecore.vercel.app/api/v1/auth/me'),
      headers: {'Authorization': 'Bearer $token'},
    );
    final profileData = jsonDecode(profileRes.body);
    final propertyId = profileData['data']['authorization']['properties'][0]['id'];
    print("Property ID: $propertyId");

    final statusRes = await http.get(
      Uri.parse('https://lodgecore.vercel.app/api/v1/night-audit/status?propertyId=$propertyId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    print("Status code: ${statusRes.statusCode}");
    print("Status response: ${statusRes.body}");
  } catch (e) {
    print(e);
  }
}

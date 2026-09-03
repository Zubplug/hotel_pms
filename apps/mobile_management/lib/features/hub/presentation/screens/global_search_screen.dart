import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'dart:async';
import '../../data/search_model.dart';
import '../../providers/hub_provider.dart';

const _bgDeep = Color(0xFF070D1A);
const _cardBg = Color(0xFF111D33);
const _surfaceNavy = Color(0xFF1E293B);
const _goldLight = Color(0xFFD4A853);
const _textPrimary = Color(0xFFEEF2FF);
const _textSecondary = Color(0xFF94A3B8);

class GlobalSearchScreen extends ConsumerStatefulWidget {
  const GlobalSearchScreen({super.key});

  @override
  ConsumerState<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends ConsumerState<GlobalSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<GlobalSearchResult> _results = [];
  bool _isLoading = false;
  Timer? _debounce;
  final Dio _dio = Dio(); // Should be injected in a real app, but this works for demo

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    
    if (query.length < 2) {
      setState(() {
        _results = [];
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 500), () {
      _performSearch(query);
    });
  }

  Future<void> _performSearch(String query) async {
    setState(() => _isLoading = true);
    
    try {
      final response = await _dio.get(
        'http://localhost:3000/api/mobile/v1/executive/search', // Replace with actual base URL in production
        queryParameters: {'q': query},
      );
      
      final List<dynamic> rawResults = response.data['data']['results'] ?? [];
      setState(() {
        _results = rawResults.map((r) => GlobalSearchResult.fromJson(r)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Search failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgDeep,
      appBar: AppBar(
        backgroundColor: _bgDeep,
        iconTheme: const IconThemeData(color: _textPrimary),
        title: TextField(
          controller: _searchController,
          style: const TextStyle(color: _textPrimary),
          decoration: const InputDecoration(
            hintText: 'Search Guests, Rooms, Staff...',
            hintStyle: TextStyle(color: _textSecondary),
            border: InputBorder.none,
          ),
          onChanged: _onSearchChanged,
          autofocus: true,
        ),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: _goldLight))
        : _results.isEmpty && _searchController.text.length > 1
          ? const Center(child: Text('No results found', style: TextStyle(color: _textSecondary)))
          : ListView.separated(
              itemCount: _results.length,
              separatorBuilder: (context, index) => const Divider(color: _surfaceNavy, height: 1),
              itemBuilder: (context, index) {
                final result = _results[index];
                return ListTile(
                  leading: Icon(_getIconForType(result.type), color: _goldLight),
                  title: Text(result.title, style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.w500)),
                  subtitle: Text(result.subtitle, style: const TextStyle(color: _textSecondary, fontSize: 13)),
                  onTap: () {
                    // Navigate to appropriate screen
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Navigate to \${result.route}')));
                  },
                );
              },
            ),
    );
  }

  IconData _getIconForType(String type) {
    switch(type) {
      case 'ROOM': return Icons.hotel;
      case 'GUEST': return Icons.person;
      case 'STAFF': return Icons.badge;
      case 'RESERVATION': return Icons.book_online;
      default: return Icons.search;
    }
  }
}

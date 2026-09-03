class GlobalSearchResult {
  final String id;
  final String type;
  final String title;
  final String subtitle;
  final String route;

  GlobalSearchResult({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.route,
  });

  factory GlobalSearchResult.fromJson(Map<String, dynamic> json) {
    return GlobalSearchResult(
      id: json['id'] ?? '',
      type: json['type'] ?? '',
      title: json['title'] ?? '',
      subtitle: json['subtitle'] ?? '',
      route: json['route'] ?? '',
    );
  }
}

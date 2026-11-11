// Domain Models for Flutter Application

class Memory {
  final String id;
  final String date; // YYYY-MM-DD
  final String title;
  final String category;
  final String notes;
  final List<String> photos;

  Memory({
    required this.id,
    required this.date,
    required this.title,
    this.category = '❤️',
    this.notes = '',
    this.photos = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date,
        'title': title,
        'category': category,
        'notes': notes,
        'photos': photos,
      };

  factory Memory.fromJson(Map<String, dynamic> json) => Memory(
        id: json['id'],
        date: json['date'],
        title: json['title'],
        category: json['category'] ?? '❤️',
        notes: json['notes'] ?? '',
        photos: List<String>.from(json['photos'] ?? []),
      );
}

class FuturePlan {
  final String id;
  final String title;
  final DateTime targetDate;
  final String category;
  final String notes;
  bool isCompleted;

  FuturePlan({
    required this.id,
    required this.title,
    required this.targetDate,
    this.category = '✈️',
    this.notes = '',
    this.isCompleted = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'targetDate': targetDate.toIso8601String(),
        'category': category,
        'notes': notes,
        'isCompleted': isCompleted,
      };

  factory FuturePlan.fromJson(Map<String, dynamic> json) => FuturePlan(
        id: json['id'],
        title: json['title'],
        targetDate: DateTime.parse(json['targetDate']),
        category: json['category'] ?? '✈️',
        notes: json['notes'] ?? '',
        isCompleted: json['isCompleted'] ?? false,
      );
}

class UserNote {
  final String id;
  final String title;
  final String category;
  final String body;
  final bool reminderEnabled;
  final DateTime? reminderDateTime;
  final DateTime createdAt;

  UserNote({
    required this.id,
    required this.title,
    this.category = '💖',
    this.body = '',
    this.reminderEnabled = false,
    this.reminderDateTime,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'category': category,
        'body': body,
        'reminderEnabled': reminderEnabled,
        'reminderDateTime': reminderDateTime?.toIso8601String(),
        'createdAt': createdAt.toIso8601String(),
      };

  factory UserNote.fromJson(Map<String, dynamic> json) => UserNote(
        id: json['id'],
        title: json['title'],
        category: json['category'] ?? '💖',
        body: json['body'] ?? '',
        reminderEnabled: json['reminderEnabled'] ?? false,
        reminderDateTime: json['reminderDateTime'] != null
            ? DateTime.parse(json['reminderDateTime'])
            : null,
        createdAt: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'])
            : DateTime.now(),
      );
}

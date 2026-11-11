import 'package:flutter/material.dart';

class HeartPainter extends CustomPainter {
  final Color fillColor;
  final Color strokeColor;

  HeartPainter({
    this.fillColor = const Color(0x66FF2A6D),
    this.strokeColor = const Color(0xFFFF2A6D),
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = fillColor
      ..style = PaintingStyle.fill;

    final strokePaint = Paint()
      ..color = strokeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;

    final path = Path();
    final width = size.width;
    final height = size.height;

    path.moveTo(width / 2, height * 0.9);
    path.cubicTo(
      width * 0.1, height * 0.55,
      0, height * 0.3,
      width * 0.25, height * 0.05,
    );
    path.cubicTo(
      width * 0.45, height * 0.05,
      width / 2, height * 0.25,
      width / 2, height * 0.25,
    );
    path.cubicTo(
      width / 2, height * 0.25,
      width * 0.55, height * 0.05,
      width * 0.75, height * 0.05,
    );
    path.cubicTo(
      width, height * 0.3,
      width * 0.9, height * 0.55,
      width / 2, height * 0.9,
    );
    path.close();

    canvas.drawPath(path, paint);
    canvas.drawPath(path, strokePaint);
  }

  @override
  bool shouldRepaint(covariant HeartPainter oldDelegate) => false;
}

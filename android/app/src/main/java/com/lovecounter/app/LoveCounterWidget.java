package com.lovecounter.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.widget.RemoteViews;

/**
 * LoveCounterWidget — Locket tarzı Ana Ekran Çift Widget'ı
 * 
 * Sadece Ana Ekran (Home Screen) Widget'ı olarak çalışır.
 * Sıfır RAM tüketimi: Android Launcher (SystemUI) tarafında RemoteViews ile işlenir.
 * Her 60 saniyede bir AlarmManager ile sadece milisaniyelik zaman hesaplaması yapıp uyur.
 *
 * Modlar:
 *   - "count_up"   : Birlikte geçen süre (başlangıç tarihinden bu yana)
 *   - "countdown"  : Bir sonraki buluşmaya geri sayım (hedef tarihe)
 */
public class LoveCounterWidget extends AppWidgetProvider {

    public static Bitmap lastWidgetBitmap = null; // Eski uyumluluk için korunuyor

    private static final String PREFS_NAME = "LoveWidgetPrefs";

    // Varsayılan değerler
    private static final String DEFAULT_NAME1 = "Tuğçe";
    private static final String DEFAULT_NAME2 = "Seçkin";
    private static final String DEFAULT_STATUS = "Birlikte 💕";
    // 23 Şubat 2026, 20:11 UTC+3 → epoch millis
    private static final long DEFAULT_START_DATE = 1771866660000L;
    private static final String DEFAULT_MODE = "count_up";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateAllWidgets(context);
        WidgetUpdateReceiver.scheduleUpdate(context);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("widget_active", true).apply();
        updateAllWidgets(context);
        WidgetUpdateReceiver.scheduleUpdate(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        WidgetUpdateReceiver.cancelUpdate(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("widget_active", false).apply();
    }

    /**
     * Tüm aktif ana ekran widget'larını günceller.
     */
    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        if (appWidgetManager == null) return;

        ComponentName widgetComponent = new ComponentName(context, LoveCounterWidget.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widgetComponent);

        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    /**
     * Tek bir ana ekran widget'ını günceller.
     */
    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String name1 = prefs.getString("name1", DEFAULT_NAME1);
        String name2 = prefs.getString("name2", DEFAULT_NAME2);
        String status = prefs.getString("status", DEFAULT_STATUS);
        String mode = prefs.getString("mode", DEFAULT_MODE);
        String theme = prefs.getString("theme", "pink");
        long startDate = prefs.getLong("start_date", DEFAULT_START_DATE);
        long targetDate = prefs.getLong("target_date", 0);
        String countdownLabel = prefs.getString("countdown_label", "Tekrar Görüşmeye:");

        // Tema Rengi Seçimi
        int bgResId = R.drawable.widget_bg_pink;
        int themeColor = android.graphics.Color.parseColor("#FF2A6D");

        if ("blue".equals(theme)) {
            bgResId = R.drawable.widget_bg_blue;
            themeColor = android.graphics.Color.parseColor("#64FFDA");
        } else if ("gold".equals(theme)) {
            bgResId = R.drawable.widget_bg_gold;
            themeColor = android.graphics.Color.parseColor("#FFD700");
        } else if ("emerald".equals(theme)) {
            bgResId = R.drawable.widget_bg_emerald;
            themeColor = android.graphics.Color.parseColor("#00F5D4");
        } else if ("rose".equals(theme)) {
            bgResId = R.drawable.widget_bg_rose;
            themeColor = android.graphics.Color.parseColor("#FF4D6D");
        }

        // Zaman farkını hesapla
        long[] timeParts;
        String label;
        if ("countdown".equals(mode) && targetDate > 0) {
            timeParts = calculateTimeDiff(System.currentTimeMillis(), targetDate);
            label = countdownLabel;
        } else {
            timeParts = calculateTimeDiff(startDate, System.currentTimeMillis());
            label = "Birlikte:";
        }

        String avatar1 = prefs.getString("avatar1", null);
        String avatar2 = prefs.getString("avatar2", null);

        // RemoteViews oluştur
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);

        // Tema Arka Planı & Kutu Kenarlıkları
        int tileBgResId = R.drawable.widget_tile_bg_pink;
        if ("blue".equals(theme)) tileBgResId = R.drawable.widget_tile_bg_blue;
        else if ("gold".equals(theme)) tileBgResId = R.drawable.widget_tile_bg_gold;
        else if ("emerald".equals(theme)) tileBgResId = R.drawable.widget_tile_bg_emerald;
        else if ("rose".equals(theme)) tileBgResId = R.drawable.widget_tile_bg_rose;

        views.setInt(R.id.widget_root, "setBackgroundResource", bgResId);
        views.setInt(R.id.widget_heart, "setColorFilter", themeColor);
        views.setInt(R.id.widget_tile1, "setBackgroundResource", tileBgResId);
        views.setInt(R.id.widget_tile2, "setBackgroundResource", tileBgResId);
        views.setInt(R.id.widget_tile3, "setBackgroundResource", tileBgResId);
        views.setInt(R.id.widget_tile4, "setBackgroundResource", tileBgResId);

        // Avatarlar (Tema rengi halkasıyla)
        Bitmap bmp1 = getAvatarBitmap(context, name1, avatar1, themeColor);
        Bitmap bmp2 = getAvatarBitmap(context, name2, avatar2, themeColor);
        views.setImageViewBitmap(R.id.widget_avatar1, bmp1);
        views.setImageViewBitmap(R.id.widget_avatar2, bmp2);

        // İsimler & Durum
        views.setTextViewText(R.id.widget_name1, name1);
        views.setTextViewText(R.id.widget_name2, name2);
        views.setTextViewText(R.id.widget_status, status);

        // Geri sayım / Sayaç (Ay, Gün, Saat, Dakika)
        views.setTextViewText(R.id.widget_countdown_label, label);
        views.setTextViewText(R.id.widget_months, String.valueOf(timeParts[0]));
        views.setTextViewText(R.id.widget_days, String.valueOf(timeParts[1]));
        views.setTextViewText(R.id.widget_hours, String.format("%02d", timeParts[2]));
        views.setTextViewText(R.id.widget_mins, String.format("%02d", timeParts[3]));

        // Tıklama → Uygulamayı aç
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_status, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_avatar1, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_avatar2, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_countdown_label, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    /**
     * Daire şeklinde avatar bitmap'i üretir.
     * Seçilen tema rengiyle (themeColor) kenarlık çizer.
     */
    private static Bitmap getAvatarBitmap(Context context, String name, String base64Image, int strokeColor) {
        int size = 120; // 120x120 yüksek çözünürlüklü daire avatar
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);

        android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        float radius = size / 2f;

        Bitmap photo = null;
        if (base64Image != null && !base64Image.trim().isEmpty()) {
            try {
                String cleanBase64 = base64Image.contains(",") ? base64Image.split(",")[1] : base64Image;
                byte[] decoded = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT);
                photo = android.graphics.BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            } catch (Exception ignored) {}
        }

        if (photo != null) {
            // 1. Fotoğraf varsa daire maskeleme
            android.graphics.BitmapShader shader = new android.graphics.BitmapShader(
                    photo, android.graphics.Shader.TileMode.CLAMP, android.graphics.Shader.TileMode.CLAMP
            );
            android.graphics.Matrix matrix = new android.graphics.Matrix();
            float scale = Math.max((float) size / photo.getWidth(), (float) size / photo.getHeight());
            float dx = (size - photo.getWidth() * scale) / 2f;
            float dy = (size - photo.getHeight() * scale) / 2f;
            matrix.setScale(scale, scale);
            matrix.postTranslate(dx, dy);
            shader.setLocalMatrix(matrix);

            paint.setShader(shader);
            canvas.drawCircle(radius, radius, radius - 4, paint);
            paint.setShader(null);
        } else {
            // 2. Fotoğraf yoksa koyu zemin üzerine beyaz baş harf
            paint.setStyle(android.graphics.Paint.Style.FILL);
            paint.setColor(android.graphics.Color.parseColor("#2D2D44"));
            canvas.drawCircle(radius, radius, radius - 4, paint);

            paint.setColor(android.graphics.Color.WHITE);
            paint.setTextSize(52f);
            paint.setTypeface(android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD));
            paint.setTextAlign(android.graphics.Paint.Align.CENTER);

            android.graphics.Paint.FontMetrics fontMetrics = paint.getFontMetrics();
            float baseline = radius - (fontMetrics.ascent + fontMetrics.descent) / 2f;

            String letter = (name != null && !name.trim().isEmpty()) ? name.trim().substring(0, 1).toUpperCase() : "?";
            canvas.drawText(letter, radius, baseline, paint);
        }

        // Tema renginde stok çember (Border)
        paint.setStyle(android.graphics.Paint.Style.STROKE);
        paint.setStrokeWidth(6f);
        paint.setColor(strokeColor);
        canvas.drawCircle(radius, radius, radius - 3, paint);

        return bitmap;
    }

    /**
     * Tüm alarmları durdurur ve widget aktifliğini kapatır.
     */
    static void deactivateAll(Context context) {
        WidgetUpdateReceiver.cancelUpdate(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("widget_active", false).apply();
    }

    /**
     * İki zaman arasındaki farkı [ay, gün, saat, dakika] olarak hesaplar.
     */
    private static long[] calculateTimeDiff(long fromMillis, long toMillis) {
        if (toMillis < fromMillis) {
            return new long[]{0, 0, 0, 0};
        }

        java.util.Calendar start = java.util.Calendar.getInstance();
        start.setTimeInMillis(fromMillis);

        java.util.Calendar end = java.util.Calendar.getInstance();
        end.setTimeInMillis(toMillis);

        int months = 0;
        java.util.Calendar temp = (java.util.Calendar) start.clone();
        while (true) {
            temp.add(java.util.Calendar.MONTH, 1);
            if (temp.after(end)) {
                temp.add(java.util.Calendar.MONTH, -1);
                break;
            }
            months++;
        }

        long remainingMillis = end.getTimeInMillis() - temp.getTimeInMillis();
        long totalSecs = remainingMillis / 1000;

        long days = totalSecs / 86400;
        long hours = (totalSecs % 86400) / 3600;
        long minutes = (totalSecs % 3600) / 60;

        return new long[]{months, days, hours, minutes};
    }
}

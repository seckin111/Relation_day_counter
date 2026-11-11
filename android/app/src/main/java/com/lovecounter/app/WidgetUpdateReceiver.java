package com.lovecounter.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * WidgetUpdateReceiver — AlarmManager tarafından her 60 saniyede bir tetiklenir.
 * Yalnızca Ana Ekran (Home Screen) Widget'ını günceller.
 * İşlem biter bitmez hemen uyur, batarya ve RAM harcamaz.
 */
public class WidgetUpdateReceiver extends BroadcastReceiver {

    private static final String ACTION_WIDGET_UPDATE = "com.lovecounter.app.ACTION_WIDGET_UPDATE";
    private static final String PREFS_NAME = "LoveWidgetPrefs";
    private static final long UPDATE_INTERVAL_MS = 60_000; // 60 saniye

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            // Cihaz yeniden başlatıldı, alarmları tekrar kur
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean isActive = prefs.getBoolean("widget_active", false);
            if (isActive) {
                scheduleUpdate(context);
                LoveCounterWidget.updateAllWidgets(context);
            }
        } else if (ACTION_WIDGET_UPDATE.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            // Ana ekran widget'ını güncelle
            LoveCounterWidget.updateAllWidgets(context);
            // Sonraki güncellemeyi planla
            scheduleUpdate(context);
        }
    }

    /**
     * AlarmManager ile 60 saniye sonra bir güncelleme planlar.
     * Batarya dostudur: Sadece tetiklenme anında çalışır ve uyur.
     */
    public static void scheduleUpdate(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, WidgetUpdateReceiver.class);
        intent.setAction(ACTION_WIDGET_UPDATE);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 1001, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        long triggerTime = System.currentTimeMillis() + UPDATE_INTERVAL_MS;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
            }
        } catch (SecurityException e) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
        }
    }

    /**
     * Planlanmış güncelleme alarmını iptal eder.
     */
    public static void cancelUpdate(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, WidgetUpdateReceiver.class);
        intent.setAction(ACTION_WIDGET_UPDATE);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 1001, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        alarmManager.cancel(pendingIntent);
    }
}

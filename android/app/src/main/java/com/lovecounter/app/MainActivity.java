package com.lovecounter.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.session.MediaSessionCompat;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

public class MainActivity extends AppCompatActivity {
    private static final String CHANNEL_ID = "love_counter_spotify_purple_v14";
    private static final int NOTIFICATION_ID = 9999;
    private static final int FILECHOOSER_RESULTCODE = 1001;

    private WebView mWebView;
    private MediaSessionCompat mMediaSession;
    private AudioTrack mSilentAudioTrack;
    private ValueCallback<Uri[]> mFilePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestNotificationPermission();
        purgeAllOldNotificationChannels();
        createNotificationChannel();
        startSilentAudioSession();

        mWebView = new WebView(this);
        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            // Android WebView Native File Chooser (Galeri & Dosya Seçme Desteği)
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (ActivityNotFoundException e) {
                    mFilePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        // Add Native JavaScript Bridge for Notifications & AppWidget
        mWebView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");

        mWebView.loadUrl("file:///android_asset/public/index.html");
        setContentView(mWebView);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (mFilePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            mFilePathCallback.onReceiveValue(results);
            mFilePathCallback = null;
        }
    }

    private void startSilentAudioSession() {
        try {
            mMediaSession = new MediaSessionCompat(this, "LoveCounterMediaSession");
            mMediaSession.setActive(true);

            int sampleRate = 44100;
            int bufferSize = AudioTrack.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_OUT_STEREO,
                    AudioFormat.ENCODING_PCM_16BIT
            );

            mSilentAudioTrack = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build())
                    .setAudioFormat(new AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                            .build())
                    .setBufferSizeInBytes(bufferSize)
                    .build();

            byte[] silentPcm = new byte[bufferSize];
            mSilentAudioTrack.write(silentPcm, 0, silentPcm.length);
            mSilentAudioTrack.setLoopPoints(0, silentPcm.length / 4, -1);
            mSilentAudioTrack.play();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }

    private void purgeAllOldNotificationChannels() {
        try {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancelAll();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    String[] oldChannels = {
                            "love_counter_lockscreen_channel",
                            "love_counter_spotify_widget_v2",
                            "love_counter_pure_5hearts_v3",
                            "love_counter_spotify_media_v4",
                            "love_counter_pure_media_v5",
                            "love_counter_crystal_v6",
                            "love_counter_pure_dark_v7",
                            "love_counter_pure_card_v8",
                            "love_counter_spotify_media_v9",
                            "love_counter_pure_text_v10",
                            "love_counter_glass_pill_v11",
                            "love_counter_pure_dark_media_v12",
                            "love_counter_white_translucent_v13"
                    };
                    for (String channelId : oldChannels) {
                        try {
                            notificationManager.deleteNotificationChannel(channelId);
                        } catch (Exception ignored) {}
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "S❤︎T Bildirimi";
            String description = "S❤︎T kilit ekranı canlı sayaç bildirimi";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            channel.setSound(null, null);
            channel.enableVibration(false);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void requestPinWidget() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AppWidgetManager appWidgetManager = mContext.getSystemService(AppWidgetManager.class);
                    ComponentName myProvider = new ComponentName(mContext, LoveCounterWidget.class);

                    if (appWidgetManager != null && appWidgetManager.isRequestPinAppWidgetSupported()) {
                        Intent pinnedWidgetUpdateIntent = new Intent(mContext, LoveCounterWidget.class);
                        pinnedWidgetUpdateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);

                        PendingIntent successCallback = PendingIntent.getBroadcast(
                                mContext, 0, pinnedWidgetUpdateIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        );

                        appWidgetManager.requestPinAppWidget(myProvider, null, successCallback);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void clearOldNotifications() {
            try {
                NotificationManager notificationManager = (NotificationManager) mContext.getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager != null) {
                    notificationManager.cancelAll();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void showLockscreenNotification(String title, String message, String base64Image) {
            try {
                NotificationManager notificationManager = (NotificationManager) mContext.getSystemService(Context.NOTIFICATION_SERVICE);

                Intent intent = new Intent(mContext, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                        mContext, 0, intent,
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
                );

                Bitmap decodedBitmap = null;
                if (base64Image != null && base64Image.contains(",")) {
                    String cleanBase64 = base64Image.split(",")[1];
                    byte[] decodedString = Base64.decode(cleanBase64, Base64.DEFAULT);
                    decodedBitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
                }

                String displayTitle = (title != null && !title.isEmpty()) ? title : "❤️ S❤︎T";
                String displayMsg = (message != null && !message.isEmpty()) ? message : "S❤︎T";

                // Spotify Style Media Player Notification (Dark Purple Background + Bright Light Text)
                NotificationCompat.Builder builder = new NotificationCompat.Builder(mContext, CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_transparent)
                        .setContentTitle(displayTitle)
                        .setContentText(displayMsg)
                        .setLargeIcon(decodedBitmap)
                        .setPriority(NotificationCompat.PRIORITY_LOW)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setOngoing(true)
                        .setSilent(true)
                        .setOnlyAlertOnce(true)
                        .setContentIntent(pendingIntent);

                if (mMediaSession != null) {
                    builder.setStyle(new MediaStyle().setMediaSession(mMediaSession.getSessionToken()));
                }

                if (decodedBitmap != null) {
                    LoveCounterWidget.lastWidgetBitmap = decodedBitmap;
                    AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(mContext);
                    ComponentName thisWidget = new ComponentName(mContext, LoveCounterWidget.class);
                    int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
                    for (int appWidgetId : appWidgetIds) {
                        LoveCounterWidget.updateAppWidget(mContext, appWidgetManager, appWidgetId);
                    }
                }

                if (notificationManager != null) {
                    notificationManager.notify(NOTIFICATION_ID, builder.build());
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void sendEventNotification(String title, String message) {
            try {
                NotificationManager notificationManager = (NotificationManager) mContext.getSystemService(Context.NOTIFICATION_SERVICE);

                Intent intent = new Intent(mContext, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                        mContext, 0, intent,
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
                );

                NotificationCompat.Builder builder = new NotificationCompat.Builder(mContext, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.btn_star)
                        .setContentTitle(title)
                        .setContentText(message)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

                if (notificationManager != null) {
                    notificationManager.notify((int) System.currentTimeMillis(), builder.build());
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // ═══════════════════════════════════════════════════
        // Locket Tarzı Widget Yönetim Arayüzü
        // ═══════════════════════════════════════════════════

        /**
         * Widget ayarlarını SharedPreferences'a kaydeder.
         * JSON formatında: { name1, name2, status, mode, start_date, target_date, countdown_label }
         */
        @JavascriptInterface
        public void saveWidgetSettings(String jsonString) {
            try {
                org.json.JSONObject json = new org.json.JSONObject(jsonString);
                android.content.SharedPreferences.Editor editor =
                        mContext.getSharedPreferences("LoveWidgetPrefs", Context.MODE_PRIVATE).edit();

                if (json.has("name1")) editor.putString("name1", json.getString("name1"));
                if (json.has("name2")) editor.putString("name2", json.getString("name2"));
                if (json.has("avatar1")) editor.putString("avatar1", json.getString("avatar1"));
                if (json.has("avatar2")) editor.putString("avatar2", json.getString("avatar2"));
                if (json.has("status")) editor.putString("status", json.getString("status"));
                if (json.has("mode")) editor.putString("mode", json.getString("mode"));
                if (json.has("theme")) editor.putString("theme", json.getString("theme"));
                if (json.has("start_date")) editor.putLong("start_date", json.getLong("start_date"));
                if (json.has("target_date")) editor.putLong("target_date", json.getLong("target_date"));
                if (json.has("countdown_label")) editor.putString("countdown_label", json.getString("countdown_label"));

                editor.apply();

                // Widget'ı hemen güncelle
                LoveCounterWidget.updateAllWidgets(mContext);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        /**
         * Mevcut widget ayarlarını JSON string olarak döner.
         */
        @JavascriptInterface
        public String getWidgetSettings() {
            try {
                android.content.SharedPreferences prefs =
                        mContext.getSharedPreferences("LoveWidgetPrefs", Context.MODE_PRIVATE);

                org.json.JSONObject json = new org.json.JSONObject();
                json.put("name1", prefs.getString("name1", "Tuğçe"));
                json.put("name2", prefs.getString("name2", "Seçkin"));
                json.put("avatar1", prefs.getString("avatar1", ""));
                json.put("avatar2", prefs.getString("avatar2", ""));
                json.put("status", prefs.getString("status", "Birlikte 💕"));
                json.put("mode", prefs.getString("mode", "count_up"));
                json.put("theme", prefs.getString("theme", "pink"));
                json.put("start_date", prefs.getLong("start_date", 1771866660000L));
                json.put("target_date", prefs.getLong("target_date", 0));
                json.put("countdown_label", prefs.getString("countdown_label", "Tekrar Görüşmeye:"));
                json.put("widget_active", prefs.getBoolean("widget_active", false));

                return json.toString();
            } catch (Exception e) {
                e.printStackTrace();
                return "{}";
            }
        }

        /**
         * Widget sistemini aktifleştirir — AlarmManager başlatır.
         */
        @JavascriptInterface
        public void activateWidget() {
            try {
                android.content.SharedPreferences.Editor editor =
                        mContext.getSharedPreferences("LoveWidgetPrefs", Context.MODE_PRIVATE).edit();
                editor.putBoolean("widget_active", true);
                editor.apply();

                // Alarmı başlat
                WidgetUpdateReceiver.scheduleUpdate(mContext);

                // İlk güncellemeyi hemen yap
                LoveCounterWidget.updateAllWidgets(mContext);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        /**
         * Widget sistemini deaktifleştirir — Alarmları ve bildirimi durdurur.
         */
        @JavascriptInterface
        public void deactivateWidget() {
            try {
                LoveCounterWidget.deactivateAll(mContext);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            if (mSilentAudioTrack != null) {
                mSilentAudioTrack.stop();
                mSilentAudioTrack.release();
            }
            if (mMediaSession != null) {
                mMediaSession.release();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onBackPressed() {
        if (mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}

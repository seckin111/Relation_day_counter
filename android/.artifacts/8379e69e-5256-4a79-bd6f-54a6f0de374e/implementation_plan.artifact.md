# Uygulama Simgesini Değiştirme ve Hata Giderme Planı

Bu plan, projenizdeki "resource mipmap/ic_launcher not found" hatasını gidermek ve gönderdiğiniz özel görseli uygulama simgesi olarak ayarlamanızı sağlamak için hazırlanmıştır.

## Kullanıcı İncelemesi Gerekli

> [!IMPORTANT]
> Ben doğrudan sohbet üzerinden gönderdiğiniz görsel dosyasını (binary/PNG olarak) projenizin içine kaydedemiyorum. Bu nedenle, önce projenin hatasız derlenmesini sağlayacak **geçici bir simge (kalp simgesi)** oluşturacağım. Ardından, gönderdiğiniz fotoğrafı Android Studio'nun "Image Asset" aracını kullanarak nasıl kalıcı simge yapacağınızı adım adım tarif edeceğim.

## Önerilen Değişiklikler

### [Kaynak Dosyaları (Resources)]

Uygulamanın standart simge yapısını (Adaptive Icon) oluşturmak için gerekli klasörleri ve dosyaları ekleyeceğim.

#### [NEW] [ic_launcher_background.xml](file:///C:/Users/USER/Documents/Tarih%20uygulaması/android/app/src/main/res/values/colors.xml) (Renk tanımı için)
#### [NEW] [ic_launcher_foreground.xml](file:///C:/Users/USER/Documents/Tarih%20uygulaması/android/app/src/main/res/drawable/ic_launcher_foreground.xml) (Geçici kalp simgesi)
#### [NEW] [ic_launcher.xml](file:///C:/Users/USER/Documents/Tarih%20uygulaması/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml)
#### [NEW] [ic_launcher_round.xml](file:///C:/Users/USER/Documents/Tarih%20uygulaması/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml)

### [Manifest]

#### [MODIFY] [AndroidManifest.xml](file:///C:/Users/USER/Documents/Tarih%20uygulaması/android/app/src/main/AndroidManifest.xml)
- `android:icon` değerini `@mipmap/ic_launcher` olarak güncelleyeceğim.
- `android:roundIcon` değerini `@mipmap/ic_launcher_round` olarak ekleyeceğim.

## Doğrulama Planı

### Otomatik Testler
- `./gradlew assembleDebug` komutu ile projenin kaynak bağlama (linking) hatası vermeden derlendiğini doğrulayacağım.

### Manuel Doğrulama (Kullanıcı Tarafından)
- Sizin gönderdiğiniz görseli uygulamak için şu adımları izlemelisiniz:
    1. Android Studio'da `app` klasörüne sağ tıklayın.
    2. `New` -> `Image Asset` seçeneğini seçin.
    3. `Icon Type` kısmında "Launcher Icons (Adaptive and Legacy)" seçili olsun.
    4. `Path` kısmından bilgisayarınıza kaydettiğiniz o fotoğrafı seçin.
    5. `Scaling` ayarlarıyla görseli kutuya sığdırın.
    6. `Next` ve `Finish` diyerek işlemi tamamlayın.

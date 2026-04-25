# Android Wrapper Guide

Dokumen ini menjelaskan cara membungkus `My Image Editor` menjadi APK Android yang bekerja offline memakai `WebView` dan aset lokal hasil build.

## Konsep

- Web app dibuild dulu ke folder `dist/`
- Isi `dist/` disalin ke `android-wrapper/app/src/main/assets/www/`
- Android app memuat file lokal itu lewat `WebViewAssetLoader`
- Karena memakai origin `https://appassets.androidplatform.net/...`, aset lokal lebih kompatibel daripada `file://`

## Struktur wrapper

```text
android-wrapper/
|- app/
|  |- src/main/assets/www/        # hasil copy dari dist
|  |- src/main/java/.../MainActivity.kt
|  |- src/main/res/
|- build.gradle.kts
|- settings.gradle.kts
|- gradle.properties
```

## Langkah build APK

1. Build web app:

```bash
npm run build
```

2. Sinkronkan aset ke Android wrapper:

```powershell
./scripts/sync-android-assets.ps1
```

3. Buka folder [android-wrapper](C:\Users\hadih\Documents\Coding%20Playground\my-image-editor\android-wrapper) di Android Studio

4. Biarkan Android Studio melakukan sync Gradle

5. Build APK:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

## Catatan penting

- Saya belum menambahkan `gradlew` wrapper binary ke repo ini
- Cara paling praktis adalah membuka proyek ini langsung di Android Studio
- Setelah aset `dist` disalin ke `assets/www`, app bisa berjalan offline tanpa hosting

## Update aset setelah ubah web app

Setiap kali Anda mengubah web app:

1. Jalankan `npm run build`
2. Jalankan `./scripts/sync-android-assets.ps1`
3. Build ulang APK di Android Studio

## Jalur release yang sudah disiapkan

- `android-wrapper/app/build.gradle.kts` sekarang sudah siap membaca signing config opsional dari:

[keystore.properties.example](C:\Users\hadih\Documents\Coding%20Playground\my-image-editor\android-wrapper\keystore.properties.example)

- Untuk langkah release end-to-end, ikuti checklist berikut:

[ANDROID_RELEASE_CHECKLIST.md](C:\Users\hadih\Documents\Coding%20Playground\my-image-editor\ANDROID_RELEASE_CHECKLIST.md)

## Kenapa ini cocok untuk kebutuhan Anda

- Tidak perlu server online saat app sudah dibungkus
- Bisa dipasang langsung di Android sebagai APK
- Semua HTML, CSS, JS, dan aset dijalankan dari paket aplikasi
- Tetap mempertahankan editor offline yang sudah kita bangun

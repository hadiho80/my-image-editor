# Android Release Checklist

Checklist ini untuk build APK release `My Image Editor` dari wrapper Android lokal.

## 1. Build web app terbaru

```powershell
npm run build
npm run sync:android
```

## 2. Siapkan keystore release

1. Buat file `android-wrapper/keystore.properties` dari contoh:

```text
android-wrapper/keystore.properties.example
```

2. Isi nilainya:

```properties
storeFile=release-keystore.jks
storePassword=YOUR_PASSWORD
keyAlias=myimageeditor
keyPassword=YOUR_PASSWORD
```

3. Letakkan file `.jks` di folder `android-wrapper/`

## 3. Build release di Android Studio

1. Buka [android-wrapper](C:\Users\hadih\Documents\Coding%20Playground\my-image-editor\android-wrapper)
2. Tunggu Gradle sync selesai
3. Pilih:

```text
Build > Generate Signed App Bundle / APK
```

4. Pilih `APK`
5. Gunakan file keystore yang sama
6. Pilih variant `release`

## 4. Output yang dicek

- APK release berhasil dibuat
- App membuka editor dari aset lokal
- Upload foto, save project, export PNG, dan share tetap jalan
- App tetap bisa dibuka tanpa internet

## 5. Visual check sebelum rilis

```powershell
npm run visual:check
```

Hasil screenshot akan ada di:

[docs/visual-check](C:\Users\hadih\Documents\Coding%20Playground\my-image-editor\docs\visual-check)

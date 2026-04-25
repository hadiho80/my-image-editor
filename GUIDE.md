# My Image Editor

Web app editor foto offline yang bisa dipakai langsung di browser, di-install sebagai PWA, lalu dipakai di Android atau iOS tanpa backend.

## Fitur utama

- Upload foto dari file lokal atau kamera
- Template kolase `Single`, `2 x 1`, `3 x 1`, dan `2 x 2`
- Slot frame bisa di-resize langsung dari canvas
- Ukuran kanvas bisa diatur custom
- Tambah stiker dekorasi
- Multi text layer dengan pengaturan font, ukuran, warna, dan posisi
- Drag langsung text layer di canvas
- Aksi cepat `Cancel` dan `Hapus` untuk elemen aktif
- Resize gambar, stiker, dan text dengan mouse wheel atau gesture dua jari
- Preset filter cepat: `Normal`, `Vintage`, `Cool`, `Warm`, `Grayscale`
- Gesture dua jari sekarang juga bisa memutar stiker dan gambar di frame
- Filter dasar `brightness`, `contrast`, `saturate`, dan `blur`
- Crop ringan per slot dengan `zoom`, `geser X`, dan `geser Y`
- Mode coret-coret dengan brush
- Simpan banyak project ke IndexedDB browser
- Import project dari file JSON
- Download hasil edit ke PNG
- Share hasil edit lewat native share sheet jika browser mendukung
- PWA installable dan bisa bekerja offline

## Struktur project

```text
my-image-editor/
|- index.html
|- styles.css
|- app.js
|- manifest.webmanifest
|- sw.js
|- package.json
|- vite.config.js
|- GUIDE.md
|- docs/
|  |- my-image-editor-mockup.html
|- assets/
|  |- icons/
|     |- icon.svg
|     |- icon-192.svg
|     |- icon-512.svg
```

## Cara menjalankan

Karena ini app statis, cara paling aman adalah menjalankannya lewat local server sederhana.

### Opsi 1: Vite dev server

```bash
npm install
npm run dev
```

Lalu buka alamat lokal yang tampil di terminal, biasanya:

```text
http://localhost:4173/
```

### Opsi 2: VS Code Live Server

1. Buka folder project `my-image-editor`
2. Jalankan Live Server
3. Buka `index.html`

### Opsi 3: Python simple server

```bash
python -m http.server 8080
```

Lalu buka:

```text
http://localhost:8080/my-image-editor/
```

## Cara install di Android

1. Buka app di Chrome
2. Tunggu sampai service worker aktif
3. Tekan menu browser
4. Pilih `Add to Home screen` atau `Install app`
5. App akan muncul seperti aplikasi biasa

## Cara install di iPhone / iPad

1. Buka app di Safari
2. Tekan tombol `Share`
3. Pilih `Add to Home Screen`
4. App akan tersimpan di home screen dan bisa dibuka fullscreen

## Catatan penting Android dan iOS

- `Web Share API` biasanya paling mulus di Android Chrome dan iOS Safari modern
- Download file fallback tetap disediakan jika share file tidak tersedia
- `beforeinstallprompt` hanya tersedia di browser tertentu, jadi tombol install bisa muncul atau tidak tergantung browser
- Di iOS, PWA install dilakukan lewat Safari `Add to Home Screen`, bukan popup otomatis
- Project tersimpan di `IndexedDB` browser. Draft aktif juga disimpan lokal agar perubahan belum tersimpan tetap aman
- Gesture pinch paling baik dipakai di browser mobile yang sudah mendukung Pointer Events modern

## Alur pakai

1. Upload foto
2. Pilih template
3. Ketuk slot untuk memilih area foto aktif
4. Ketuk thumbnail foto untuk menaruhnya ke slot aktif
5. Gunakan kontrol `Crop Slot Aktif` untuk zoom dan geser isi foto
6. Jika frame kosong, klik frame lalu pilih pakai gambar yang sudah ada atau upload baru
7. Drag thumbnail foto ke frame jika ingin isi frame via drag-drop
8. Drag gambar dari satu frame ke frame lain untuk tukar posisi
9. Tambah stiker jika perlu, lalu pilih stikernya untuk atur ukuran dan rotasi
10. Tambah satu atau beberapa text layer
11. Atur warna background teks lewat color picker atau input warna
12. Gunakan mouse wheel atau dua jari untuk membesarkan atau mengecilkan elemen aktif
13. Gunakan tombol `Cancel` atau `Hapus` saat elemen sedang aktif
14. Atur filter global
15. Aktifkan mode draw bila ingin coret-coret
16. Simpan project atau `Simpan Sebagai`
17. Import atau export JSON project bila perlu
18. Share hasil edit ke aplikasi lain jika browser mendukung

## Penyimpanan project

- Tombol `Simpan` mengupdate project aktif ke IndexedDB
- Tombol `Simpan Sebagai` membuat project baru dengan nama baru
- Tombol `Rename Project` mengganti nama project aktif
- Panel `Saved Projects` menampilkan daftar project tersimpan
- Tombol `Muat Project Tersimpan` memuat project terbaru
- Tombol `Import JSON Project` membuka snapshot project dari file
- Tombol `Download JSON Project` mengunduh snapshot project aktif

## Keterbatasan versi ini

- Filter masih berlaku global untuk semua slot
- Autosave ke IndexedDB berjalan saat project sudah pernah disimpan setidaknya sekali
- Resize slot frame sudah dibatasi agar tidak mudah overlap, dengan snapping yang lebih presisi ke tepi slot lain dan batas kanvas

## Pengembangan lanjutan yang direkomendasikan

1. Tambah import batch foto tanpa mengganti semua slot sekaligus
2. Tambah per-slot filter agar tiap frame bisa punya mood berbeda
3. Tambah rotate handle visual untuk desktop selain gesture dua jari
4. Tambah smart guides visual saat snapping frame
5. Tambah generator icon PNG jika ingin distribusi PWA lebih luas

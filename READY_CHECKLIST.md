# My Image Editor - Ready Checklist

Tanggal checklist: 24 April 2026

## 1) Fitur Inti Editor
- [x] Upload foto dari file lokal.
- [x] Klik slot kosong untuk assign foto.
- [x] Drag foto dari library ke slot.
- [x] Drag foto antar slot (swap).
- [x] Resize frame (desktop) dengan handle.
- [x] Geser/zoom/rotate foto di slot (gesture + wheel).
- [x] Tambah text layer.
- [x] Pilih, drag, resize text layer.
- [x] Ubah warna teks, font, ukuran, posisi.
- [x] Ubah background text dan preview warna tampil sesuai nilai.
- [x] Tambah stiker dari panel.
- [x] Drag, resize, rotate stiker.
- [x] Tombol `Cancel` dan `Hapus` aktif untuk selection desktop + mobile.
- [x] Undo / Redo berjalan.

## 2) Export, Save, Share
- [x] Export PNG lokal.
- [x] Share via Web Share API (dengan fallback download).
- [x] Save project ke IndexedDB.
- [x] Save As project.
- [x] Load latest project.
- [x] Import project JSON (invalid JSON ditangani dengan alert).
- [x] Download project JSON.

## 3) Offline dan PWA
- [x] Service worker terdaftar.
- [x] Manifest tersedia.
- [x] Install button tersedia saat browser mendukung `beforeinstallprompt`.

## 4) Mobile UX (Screen 1-3)
- [x] Home / Editor / Share mobile dipisah.
- [x] Editor mobile tidak bergantung panel desktop.
- [x] Tool panel mobile aktif untuk frame, stiker, text, filter, draw, layer.
- [x] Selection actions (`Cancel`, `Hapus`) muncul di canvas mobile.

## 5) Desktop UX (Screen 4)
- [x] Layout full-screen, topbar + left rail + canvas + right panel.
- [x] Tombol topbar (`Undo`, `Redo`, `Simpan`, `PNG`, `Share`) aktif.

## 6) Build dan Distribusi
- [x] `npm run build` berhasil.
- [x] `npm run sync:android` berhasil.
- [x] Visual snapshot check berhasil (`docs/visual-check`).
- [ ] Build APK release ditandatangani (`./gradlew assembleRelease` + keystore final).

## 7) Catatan Final Sebelum Rilis
- APK release masih butuh keystore produksi final.
- Uji perangkat fisik disarankan untuk validasi gesture multi-touch dan flow share per device.

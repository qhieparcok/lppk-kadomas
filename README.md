# Pengelola Laporan Tahunan — Kelurahan Kadomas (Laporan Tahunan)

Aplikasi mandiri (static site, tanpa build step) untuk Sekretaris Lurah
**Kelurahan Kadomas** menyusun **Laporan Penyelenggaraan Pemerintahan
Kelurahan (Laporan Tahunan)**. Masuk dengan email dan kata sandi —
pendaftar pertama otomatis menjadi admin; akun baru harus disetujui admin
dulu sebelum bisa memakai aplikasi.

**Tanpa realisasi keuangan** — keuangan dikelola langsung oleh kecamatan.

## Fitur

| Bagian | Isi |
|---|---|
| **Beranda** | Alur 4 langkah (01 Identitas → 02 Isi Data → 03 Rekap → 04 Cetak & Serah), papan kelengkapan 10 kelompok data Laporan Tahunan per tahun, persen kelengkapan yang menghitung naik + bilah progres beranimasi, form identitas kelurahan & penandatangan (Lurah + Sekretaris) |
| **Input Data** | Monografi per 31 Desember + 11 kategori entri yang bisa tambah/ubah/hapus: program kerja, pelayanan, surat masuk, surat keluar (buku agenda), pembangunan, pembinaan kemasyarakatan, pemberdayaan masyarakat, kesehatan & pendidikan, permasalahan & kendala, rencana tindak lanjut, **PBB (Pajak Bumi dan Bangunan)** |
| **Rekap** | Kartu ringkasan (total entri, surat masuk/keluar, kelompok terisi), donat capaian beranimasi, grafik batang per kategori |
| **Cetak Laporan Tahunan** | Dokumen resmi BAB I–IX dengan kop kelurahan dan lembar tanda tangan, siap cetak / simpan PDF lewat dialog cetak browser. BAB III memuat ringkasan PBB (jumlah SPPT, target, realisasi, % capaian, tunggakan) |
| **Pengguna (admin)** | Daftar akun, setujui akun baru, ubah peran admin/user, nonaktifkan akun |
| **Materi** | Syarat menjadi Sekretaris Lurah, 10 kelompok data laporan + laporan yang dihasilkan, dan roadmap 6 tahap (Okt–Mar) yang **menggambar jalurnya sendiri saat digulir** (self-drawing SVG path, pola Scrolltide) |

## Portal login (admin & user)

- Login memakai **Supabase Auth (email + kata sandi)**. Pendaftar pertama
  otomatis menjadi **admin** dan langsung disetujui; pendaftar berikutnya
  menjadi **user** dan harus disetujui admin di tab **Pengguna**.
- **Admin** bisa semuanya: identitas, input, cetak, dan kelola pengguna.
  **User** bisa input data dan lihat rekap; tidak bisa ubah identitas,
  cetak, atau kelola pengguna. Pulihkan cadangan hanya admin.
- Data lama tetap bisa dibaca semua pengguna yang sudah login + disetujui.
- Aturan akses ditegakkan di database (RLS di `supabase-schema.sql`):
  tanpa login, data tidak bisa dibaca maupun ditulis.
- **Satu langkah di dashboard Supabase:** Authentication → URL Configuration
  → **Site URL** isi `https://kadomas.vercel.app` (dan tambahkan juga
  `https://qhieparcok.github.io/lppk-kadomas/` di Redirect URLs) supaya
  tautan konfirmasi email pendaftar mengarah kembali ke situs.

Desain mengikuti gaya Visual Explorer: monokrom hitam-putih + aksen lime,
kartu 20px, tombol pill, Inter + Instrument Serif italic + JetBrains Mono.
Dokumen cetak tetap formal (Times New Roman, hitam-putih).
Menghormati `prefers-reduced-motion` dan tetap terbaca tanpa JavaScript.

## Menjalankan lokal

```bash
cd lppk-public
python3 -m http.server 8000
# buka http://localhost:8000
```

Bisa juga dibuka langsung sebagai file (`index.html`), tapi font Google dan
Supabase butuh koneksi internet.

## Menghubungkan Supabase (data bersama)

Tanpa Supabase, aplikasi berjalan penuh dalam **Mode lokal** — data tersimpan di
`localStorage` browser masing-masing (tidak bersama). Untuk data bersama:

1. **Buat project gratis** di https://supabase.com (New project, nama proyek:
   `lppk-lurah`).
2. **Buat tabel:** buka **SQL Editor → New query**, tempel seluruh isi
   `supabase-schema.sql`, lalu **Run**.
3. **Salin kredensial:** buka **Settings → API**, salin **Project URL** dan
   **anon public key**.
4. **Isi `config.js`:**
   ```js
   window.LAPORAN_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi..."
   };
   ```
   ⚠️ Isi **anon key saja** — jangan pernah menulis `service_role` key di sini.
5. Muat ulang halaman. Penanda di pojok kanan atas berubah menjadi
   **"Mode bersama · Supabase"**.

> **Catatan keamanan:** sejak 26 Nov 2026, akses dibatasi login (Supabase Auth)
> + peran admin/user — kebijakan RLS di `supabase-schema.sql` hanya mengizinkan
> pengguna yang sudah login dan disetujui. Tanpa login, data tidak bisa dibaca
> maupun ditulis. Jangan simpan data rahasia di sini.

## Deploy ke Vercel

Nama proyek yang disarankan: **`kadomas`**.

```bash
npm i -g vercel   # sekali saja
cd lppk-public
vercel --prod     # saat ditanya nama proyek, isi: kadomas
```

Atau lewat dashboard Vercel: **Add New → Project → Import** folder ini
(atau repo Git yang berisi folder ini sebagai root). Tidak ada build command
dan tidak ada environment variable — `config.js` sudah berisi URL Supabase.

## Struktur file

```
lppk-public/
├── index.html            # Struktur aplikasi (5 tab + panggung roadmap)
├── style.css             # Desain Scrolltide house style + print CSS
├── app.js                # Logika aplikasi, data layer, scroll engine roadmap
├── config.js             # URL + anon key Supabase (placeholder kosong)
├── supabase-schema.sql   # CREATE TABLE + RLS terbuka
├── vercel.json           # Konfigurasi static site Vercel
└── README.md             # File ini
```

## Identitas default

Kelurahan sudah terisi default **Kadomas** (form identitas, kop dokumen Laporan Tahunan,
dan lembar tanda tangan). Kecamatan sengaja dikosongkan — isi sendiri sesuai
kecamatan Kelurahan Kadomas. Nama Lurah, NIP, dan penandatangan juga diisi
sendiri lewat form Identitas di Beranda.

Di Beranda ada tombol **Unduh cadangan (JSON)** dan **Pulihkan cadangan** —
berguna untuk memindahkan data antar mode (lokal ↔ Supabase) atau sebagai
arsip tahunan.

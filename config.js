/* ============================================================
   Konfigurasi Supabase — Pengelola Laporan Tahunan Lurah
   ------------------------------------------------------------
   CARA MENGISI:
   1. Buat project gratis di https://supabase.com
   2. Jalankan isi file supabase-schema.sql di SQL Editor Supabase
      (menu SQL Editor → New query → tempel → Run).
   3. Salin Project URL dan anon key dari
      Settings → API, lalu isi dua nilai di bawah ini.
   4. Deploy ulang (Vercel) atau muat ulang halaman.

   Kedua nilai di bawah ini WAJIB terisi — tanpa Supabase aplikasi
   tidak berjalan (tidak ada lagi Mode lokal; data harus bersama
   supaya bisa dipakai semua orang). Jangan pernah menulis
   service_role key di file ini: anon key saja sudah cukup dan aman
   untuk dibagikan.
   ============================================================ */

window.LAPORAN_CONFIG = {
  SUPABASE_URL: "https://dfecgipnzzxrasqyvkne.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmZWNnaXBuenp4cmFzcXl2a25lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1MTQ4MDksImV4cCI6MjExMTA5MDgwOX0.YC7F2vK6SWmFYTBb0_zxv6CAvPQgFzW6t4l82wv1LFE"
};

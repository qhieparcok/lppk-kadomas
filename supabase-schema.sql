-- ============================================================
-- Skema Supabase — Pengelola Laporan Tahunan Lurah (Laporan Tahunan)
-- Jalankan file ini di Supabase Dashboard → SQL Editor → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Identitas kelurahan & penandatangan (satu baris per tahun)
-- ------------------------------------------------------------
create table if not exists public.report_settings (
  id          uuid primary key default gen_random_uuid(),
  tahun       integer not null unique,
  kelurahan   text,
  kecamatan   text,
  lurah_nama  text,
  lurah_nip   text,
  sek_nama    text,
  sek_nip     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) Monografi kelurahan per 31 Desember (satu baris per tahun)
-- ------------------------------------------------------------
create table if not exists public.monografi (
  id                  uuid primary key default gen_random_uuid(),
  tahun               integer not null unique,
  luas_wilayah        numeric,
  jumlah_lingkungan   integer,
  jumlah_rw           integer,
  jumlah_rt           integer,
  jumlah_kk           integer,
  penduduk_l          integer,
  penduduk_p          integer,
  sarana_pendidikan   integer,
  sarana_kesehatan    integer,
  sarana_ibadah       integer,
  batas_utara         text,
  batas_selatan       text,
  batas_timur         text,
  batas_barat         text,
  keterangan          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3) Entri data (10 kategori, per tahun laporan)
--    kategori: program_kerja | pelayanan | surat_masuk |
--              surat_keluar | pembangunan | pembinaan |
--              pemberdayaan | kesehatan_pendidikan |
--              permasalahan | tindak_lanjut
-- ------------------------------------------------------------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  tahun       integer not null,
  kategori    text not null,
  judul       text not null,
  deskripsi   text,
  tanggal     date,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists items_tahun_idx on public.items (tahun);
create index if not exists items_kategori_idx on public.items (kategori);

-- ============================================================
-- RLS — Row Level Security
-- ------------------------------------------------------------
-- PERINGATAN, BACA DULU:
-- Kebijakan di bawah ini SENGAJA TERBUKA (publik baca + tulis
-- tanpa login), sesuai permintaan: siapa pun yang membuka link
-- website bisa mengisi data bersama.
--
-- Konsekuensinya: siapa pun yang tahu URL Supabase project ini
-- bisa membaca dan mengubah seluruh data. Jangan simpan data
-- rahasia di sini. Bila nanti butuh pembatasan (mis. hanya staf
-- kelurahan yang boleh menulis), ganti kebijakan di bawah dengan
-- autentikasi Supabase Auth (email + password) dan policy
-- berbasis auth.uid().
-- ============================================================
alter table public.report_settings enable row level security;
alter table public.monografi enable row level security;
alter table public.items enable row level security;

create policy "Publik baca report_settings"
  on public.report_settings for select using (true);
create policy "Publik tulis report_settings"
  on public.report_settings for all using (true) with check (true);

create policy "Publik baca monografi"
  on public.monografi for select using (true);
create policy "Publik tulis monografi"
  on public.monografi for all using (true) with check (true);

create policy "Publik baca items"
  on public.items for select using (true);
create policy "Publik tulis items"
  on public.items for all using (true) with check (true);

-- ============================================================
-- HAK AKSES ROLE (WAJIB — tanpa ini semua baca/tulis gagal)
-- ------------------------------------------------------------
-- Kebijakan RLS di atas saja TIDAK CUKUP: role anon (dan
-- authenticated) juga harus diberi hak atas tabelnya, kalau
-- tidak PostgREST menolak dengan 42501 "permission denied for
-- table ...". Ini penyebab laporan tidak bisa disimpan pada
-- 26 Nov 2026 — tabel + policy sudah ada, tapi GRANT belum
-- pernah dijalankan. Diperbaiki 26 Nov 2026 via pooler
-- aws-1-ap-southeast-1 (port 6543): GRANT di bawah ini.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.report_settings to anon, authenticated;
grant select, insert, update, delete on public.monografi to anon, authenticated;
grant select, insert, update, delete on public.items to anon, authenticated;

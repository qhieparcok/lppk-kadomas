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
  kasi_pembangunan_nama      text,
  kasi_pembangunan_nip       text,
  kasi_pemerintahan_nama     text,
  kasi_pemerintahan_nip      text,
  kasi_kesos_nama            text,
  kasi_kesos_nip             text,
  penandatangan_kedua        text not null default 'sekretaris'
    check (penandatangan_kedua in ('sekretaris', 'kasi_pembangunan', 'kasi_pemerintahan', 'kasi_kesos')),
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

-- ============================================================
-- LOGIN (Supabase Auth) + PERAN admin/user — 26 Nov 2026
-- ------------------------------------------------------------
-- Peran disimpan di public.profiles. Pendaftar pertama otomatis
-- jadi admin (dan langsung disetujui); pendaftar berikutnya jadi
-- user dan harus disetujui admin dulu sebelum bisa memakai aplikasi.
-- Data lama (tanpa pemilik) tetap bisa dibaca semua pengguna yang
-- sudah login + disetujui.
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;

-- Pembantu RLS (security definer: membaca profiles tanpa rekursi RLS)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and approved = true);
$$;
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and approved = true);
$$;

-- Pendaftar baru: yang pertama jadi admin, sisanya user belum disetujui
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role, approved)
  values (
    new.id,
    coalesce(new.email, ''),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'user' end,
    case when (select count(*) from public.profiles) = 0 then true else false end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Kebijakan profiles: yang login bisa membaca daftar; tulis profil
-- sendiri saat pertama kali (cadangan bila trigger gagal); ubah
-- peran/persetujuan hanya admin.
drop policy if exists "Profil dibaca yang login" on public.profiles;
create policy "Profil dibaca yang login" on public.profiles
  for select to authenticated using (true);
drop policy if exists "Profil dibuat sendiri" on public.profiles;
create policy "Profil dibuat sendiri" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "Profil diubah admin" on public.profiles;
create policy "Profil diubah admin" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Cabut kebijakan publik lama di 3 tabel data
drop policy if exists "Publik baca report_settings" on public.report_settings;
drop policy if exists "Publik tulis report_settings" on public.report_settings;
drop policy if exists "Publik baca monografi" on public.monografi;
drop policy if exists "Publik tulis monografi" on public.monografi;
drop policy if exists "Publik baca items" on public.items;
drop policy if exists "Publik tulis items" on public.items;

-- report_settings (identitas): baca = login + disetujui; tulis = admin saja
drop policy if exists "Identitas dibaca yang login" on public.report_settings;
create policy "Identitas dibaca yang login" on public.report_settings
  for select to authenticated using (public.is_approved());
drop policy if exists "Identitas ditulis admin" on public.report_settings;
create policy "Identitas ditulis admin" on public.report_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- monografi: baca + tulis = login + disetujui
drop policy if exists "Monografi dibaca yang login" on public.monografi;
create policy "Monografi dibaca yang login" on public.monografi
  for select to authenticated using (public.is_approved());
drop policy if exists "Monografi ditulis yang login" on public.monografi;
create policy "Monografi ditulis yang login" on public.monografi
  for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- items (termasuk entri PBB): baca + tulis = login + disetujui
drop policy if exists "Entri dibaca yang login" on public.items;
create policy "Entri dibaca yang login" on public.items
  for select to authenticated using (public.is_approved());
drop policy if exists "Entri ditulis yang login" on public.items;
create policy "Entri ditulis yang login" on public.items
  for all to authenticated using (public.is_approved()) with check (public.is_approved());

-- ===========================================================
-- MIGRASI 27 Nov 2026 — Penandatangan kedua per bidang
-- -----------------------------------------------------------
-- Penandatangan di samping Lurah kini bisa dipilih per bidang:
-- Sekretaris Lurah, Kasi Pembangunan, Kasi Pemerintahan, atau
-- Kasi Kesejahteraan Sosial. Nama + NIP tiap Kasi disimpan di
-- report_settings; pilihan bidang tersimpan per tahun laporan.
-- Jalankan blok ini sekali di SQL Editor bila tabel sudah ada.
-- ===========================================================
alter table public.report_settings
  add column if not exists kasi_pembangunan_nama text,
  add column if not exists kasi_pembangunan_nip text,
  add column if not exists kasi_pemerintahan_nama text,
  add column if not exists kasi_pemerintahan_nip text,
  add column if not exists kasi_kesos_nama text,
  add column if not exists kasi_kesos_nip text,
  add column if not exists penandatangan_kedua text not null default 'sekretaris';
alter table public.report_settings
  drop constraint if exists report_settings_penandatangan_kedua_check;
alter table public.report_settings
  add constraint report_settings_penandatangan_kedua_check
  check (penandatangan_kedua in ('sekretaris', 'kasi_pembangunan', 'kasi_pemerintahan', 'kasi_kesos'));

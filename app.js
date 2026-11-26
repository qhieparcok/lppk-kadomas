/* ============================================================
   Pengelola Laporan Tahunan Lurah (versi publik mandiri)
   Static site, tanpa build step.
   Data: Supabase (bila config.js terisi) atau localStorage.
   Scroll: satu rAF loop, pola engine Scrolltide (tanpa Lenis).
   ============================================================ */
'use strict';

/* ---------- Util ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const range = (v, a, b) => clamp((v - a) / (b - a));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));
const fmtNum = (n) => Number(n || 0).toLocaleString('id-ID');
const fmtRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const MONEY_KEYS = new Set(['target', 'realisasi', 'tunggakan']);
const fmtMetaChip = (k, v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return MONEY_KEYS.has(k) && !isNaN(Number(s)) ? `${esc(k)}: ${fmtRp(s)}` : `${esc(k)}: ${esc(s)}`;
};
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Konstanta domain ---------- */
// Identitas default: kelurahan sudah terisi "Kadomas"; kecamatan sengaja
// kosong — diisi sendiri oleh pengguna (jangan ditebak).
const DEFAULT_SETTINGS = {
  kelurahan: 'Kadomas', kecamatan: '',
  lurah_nama: '', lurah_nip: '', sek_nama: '', sek_nip: '',
};

const CATEGORIES = [
  { id: 'program_kerja', num: '01', name: 'Program Kerja', group: 'program_kerja',
    desc: 'Realisasi program kerja kelurahan sepanjang tahun.',
    meta: [
      { key: 'target', label: 'Target', type: 'text', placeholder: 'cth. 12 kegiatan' },
      { key: 'realisasi', label: 'Realisasi', type: 'text', placeholder: 'cth. 11 kegiatan' },
      { key: 'status', label: 'Status', type: 'select', options: ['Tercapai', 'Sebagian', 'Belum tercapai'] },
    ] },
  { id: 'pelayanan', num: '02', name: 'Pelayanan', group: 'pelayanan',
    desc: 'Jenis dan jumlah pelayanan administrasi kepada warga.',
    meta: [
      { key: 'jenis', label: 'Jenis layanan', type: 'text', placeholder: 'cth. KTP, KK, Surat Keterangan' },
      { key: 'jumlah', label: 'Jumlah dilayani', type: 'number', placeholder: 'cth. 320' },
    ] },
  { id: 'surat_masuk', num: '03', name: 'Surat Masuk', group: 'pelayanan',
    desc: 'Buku agenda surat masuk: nomor, tanggal, pengirim, dan perihal.',
    meta: [
      { key: 'nomor', label: 'Nomor surat', type: 'text', placeholder: 'cth. 005/Und/X/2026' },
      { key: 'pengirim', label: 'Pengirim', type: 'text', placeholder: 'cth. Kecamatan Cibinong' },
      { key: 'perihal', label: 'Perihal', type: 'text', placeholder: 'cth. Undangan rapat koordinasi' },
    ] },
  { id: 'surat_keluar', num: '04', name: 'Surat Keluar', group: 'pelayanan',
    desc: 'Buku agenda surat keluar: nomor, tanggal, penerima, dan perihal.',
    meta: [
      { key: 'nomor', label: 'Nomor surat', type: 'text', placeholder: 'cth. 042/Kel/XI/2026' },
      { key: 'penerima', label: 'Penerima', type: 'text', placeholder: 'cth. Kecamatan Cibinong' },
      { key: 'perihal', label: 'Perihal', type: 'text', placeholder: 'cth. Laporan bulanan Oktober' },
    ] },
  { id: 'pembangunan', num: '05', name: 'Pembangunan', group: 'pembangunan',
    desc: 'Kegiatan pembangunan fisik dan sarana di kelurahan.',
    meta: [
      { key: 'lokasi', label: 'Lokasi', type: 'text', placeholder: 'cth. RW 04' },
      { key: 'volume', label: 'Volume', type: 'text', placeholder: 'cth. 250 meter' },
      { key: 'status', label: 'Status', type: 'select', options: ['Selesai', 'Berjalan', 'Direncanakan'] },
    ] },
  { id: 'pembinaan', num: '06', name: 'Pembinaan Kemasyarakatan', group: 'pembinaan',
    desc: 'Pembinaan RT/RW, LPM, PKK, Karang Taruna, dan lembaga kemasyarakatan.',
    meta: [
      { key: 'lembaga', label: 'Lembaga / sasaran', type: 'text', placeholder: 'cth. PKK Kelurahan' },
      { key: 'jumlah', label: 'Jumlah kegiatan', type: 'number', placeholder: 'cth. 8' },
    ] },
  { id: 'pemberdayaan', num: '07', name: 'Pemberdayaan Masyarakat', group: 'pemberdayaan',
    desc: 'Pelatihan, pendampingan UMKM, dan kegiatan pemberdayaan warga.',
    meta: [
      { key: 'sasaran', label: 'Sasaran', type: 'text', placeholder: 'cth. Pelaku UMKM RW 02' },
      { key: 'peserta', label: 'Jumlah peserta', type: 'number', placeholder: 'cth. 45' },
    ] },
  { id: 'kesehatan_pendidikan', num: '08', name: 'Kesehatan & Pendidikan', group: 'kesehatan_pendidikan',
    desc: 'Posyandu, imunisasi, stunting, sekolah, dan PAUD.',
    meta: [
      { key: 'bidang', label: 'Bidang', type: 'select', options: ['Kesehatan', 'Pendidikan'] },
      { key: 'jumlah', label: 'Jumlah', type: 'number', placeholder: 'cth. 120' },
    ] },
  { id: 'permasalahan', num: '09', name: 'Permasalahan & Kendala', group: 'permasalahan',
    desc: 'Permasalahan dan kendala yang dihadapi selama tahun laporan.',
    meta: [
      { key: 'tingkat', label: 'Tingkat', type: 'select', options: ['Ringan', 'Sedang', 'Berat'] },
    ] },
  { id: 'tindak_lanjut', num: '10', name: 'Rencana Tindak Lanjut', group: 'tindak_lanjut',
    desc: 'Rencana tindak lanjut atas permasalahan dan program yang belum tuntas.',
    meta: [
      { key: 'penanggung_jawab', label: 'Penanggung jawab', type: 'text', placeholder: 'cth. Seksi Pemerintahan' },
      { key: 'target_waktu', label: 'Target waktu', type: 'text', placeholder: 'cth. Triwulan I tahun berikutnya' },
    ] },
  { id: 'pbb', num: '11', name: 'PBB (Pajak Bumi dan Bangunan)', group: 'pbb',
    desc: 'Pajak Bumi dan Bangunan: SPPT, target, realisasi, dan tunggakan per tahun pajak.',
    meta: [
      { key: 'tahun_pajak', label: 'Tahun pajak', type: 'text', placeholder: 'cth. 2026' },
      { key: 'jumlah_sppt', label: 'Jumlah SPPT', type: 'number', placeholder: 'cth. 1250' },
      { key: 'target', label: 'Target (Rp)', type: 'number', placeholder: 'cth. 450000000' },
      { key: 'realisasi', label: 'Realisasi (Rp)', type: 'number', placeholder: 'cth. 380000000' },
      { key: 'tunggakan', label: 'Tunggakan (Rp)', type: 'number', placeholder: 'cth. 70000000' },
      { key: 'status', label: 'Status', type: 'select', options: ['Lunas', 'Sebagian', 'Belum lunas'] },
    ] },
];

const GROUPS = [
  { id: 'monografi', name: 'Monografi Kelurahan', hint: 'per 31 Desember' },
  { id: 'program_kerja', name: 'Realisasi Program Kerja', hint: 'entri program' },
  { id: 'pelayanan', name: 'Pelayanan & Surat', hint: 'pelayanan + agenda surat' },
  { id: 'pembangunan', name: 'Pembangunan', hint: 'entri pembangunan' },
  { id: 'pembinaan', name: 'Pembinaan Kemasyarakatan', hint: 'entri pembinaan' },
  { id: 'pemberdayaan', name: 'Pemberdayaan Masyarakat', hint: 'entri pemberdayaan' },
  { id: 'kesehatan_pendidikan', name: 'Kesehatan & Pendidikan', hint: 'entri kes./pend.' },
  { id: 'permasalahan', name: 'Permasalahan & Kendala', hint: 'entri permasalahan' },
  { id: 'tindak_lanjut', name: 'Rencana Tindak Lanjut', hint: 'entri tindak lanjut' },
  { id: 'pbb', name: 'PBB — Pajak Bumi dan Bangunan', hint: 'entri PBB' },
];

const MONOGRAFI_FIELDS = [
  'luas_wilayah', 'jumlah_lingkungan', 'jumlah_rw', 'jumlah_rt', 'jumlah_kk',
  'penduduk_l', 'penduduk_p', 'sarana_pendidikan', 'sarana_kesehatan', 'sarana_ibadah',
  'batas_utara', 'batas_selatan', 'batas_timur', 'batas_barat', 'keterangan',
];

const ROADMAP_STEPS = [
  { kicker: 'Tahap 1 · Oktober – November', title: 'Persiapan',
    body: 'Susun tim penyusun, tetapkan format dan template Laporan Tahunan, dan inventarisasi data yang sudah ada.' },
  { kicker: 'Tahap 2 · November – Desember', title: 'Pengumpulan Berjalan',
    body: 'Kumpulkan data bulanan: surat masuk dan keluar, pelayanan, dan kependudukan. Tutup monografi per 31 Desember.' },
  { kicker: 'Tahap 3 · Januari', title: 'Rekap Akhir & Surat',
    body: 'Rekap seluruh data tahun berjalan, verifikasi dan validasi, hitung capaian terhadap target, dan rekap buku agenda surat.' },
  { kicker: 'Tahap 4 · Februari', title: 'Penyusunan Draf',
    body: 'Tulis draf Laporan Tahunan BAB I–IX dari data yang sudah direkap, lalu review internal bersama Lurah.' },
  { kicker: 'Tahap 5 · Akhir Februari – Awal Maret', title: 'Pemeriksaan & Pengesahan',
    body: 'Pemeriksaan akhir, koreksi, kemudian pengesahan dan tanda tangan oleh Lurah.' },
  { kicker: 'Tahap 6 · Maret', title: 'Penyerahan ke Camat',
    body: 'Serahkan Laporan Tahunan ke Camat. Batas waktu: paling lambat 3 bulan setelah tahun anggaran berakhir.' },
];

/* ---------- State ---------- */
const state = {
  year: new Date().getFullYear(),
  settings: null,
  monografi: null,
  items: [],
  tab: 'beranda',
  category: 'program_kerja',
  editingId: null,
  store: null,
};

/* ---------- Data layer ---------- */
function createLocalStore() {
  const key = (year, kind) => `laporan-tahunan:${year}:${kind}`;
  const oldKey = (year, kind) => `lppk:${year}:${kind}`; // kunci lama, hanya untuk migrasi sekali baca
  const read = (year, kind, fallback) => {
    try {
      let raw = localStorage.getItem(key(year, kind));
      if (!raw) { // migrasi: data lama (mode lokal) ikut pindah ke kunci baru
        raw = localStorage.getItem(oldKey(year, kind));
        if (raw) { localStorage.setItem(key(year, kind), raw); localStorage.removeItem(oldKey(year, kind)); }
      }
      return raw ? JSON.parse(raw) : fallback;
    }
    catch { return fallback; }
  };
  const write = (year, kind, val) => localStorage.setItem(key(year, kind), JSON.stringify(val));
  return {
    mode: 'local',
    async loadSettings(year) { return read(year, 'settings', null); },
    async saveSettings(year, v) { write(year, 'settings', v); },
    async loadMonografi(year) { return read(year, 'monografi', null); },
    async saveMonografi(year, v) { write(year, 'monografi', v); },
    async loadItems(year) { return read(year, 'items', []); },
    async saveItems(year, items) { write(year, 'items', items); },
  };
}

function loadSupabaseClient(url, key) {
  if (window.supabase) return Promise.resolve(window.supabase.createClient(url, key));
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload = () => resolve(window.supabase.createClient(url, key));
    s.onerror = () => reject(new Error('Gagal memuat pustaka Supabase'));
    document.head.appendChild(s);
  });
}

function createSupabaseStore(client) {
  const clean = (obj) => {
    const o = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined) o[k] = v;
    return o;
  };
  const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    mode: 'supabase',
    async loadSettings(year) {
      const { data, error } = await client.from('report_settings').select('*').eq('tahun', year).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { kelurahan: data.kelurahan || '', kecamatan: data.kecamatan || '', lurah_nama: data.lurah_nama || '', lurah_nip: data.lurah_nip || '', sek_nama: data.sek_nama || '', sek_nip: data.sek_nip || '' };
    },
    async saveSettings(year, v) {
      const { error } = await client.from('report_settings').upsert(clean({ tahun: year, ...v }), { onConflict: 'tahun' });
      if (error) throw error;
    },
    async loadMonografi(year) {
      const { data, error } = await client.from('monografi').select('*').eq('tahun', year).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const out = {};
      for (const f of MONOGRAFI_FIELDS) out[f] = data[f] ?? '';
      return out;
    },
    async saveMonografi(year, v) {
      const row = { tahun: year };
      for (const f of MONOGRAFI_FIELDS) {
        row[f] = ['luas_wilayah', 'jumlah_lingkungan', 'jumlah_rw', 'jumlah_rt', 'jumlah_kk', 'penduduk_l', 'penduduk_p', 'sarana_pendidikan', 'sarana_kesehatan', 'sarana_ibadah'].includes(f)
          ? numOrNull(v[f]) : (v[f] || null);
      }
      const { error } = await client.from('monografi').upsert(clean(row), { onConflict: 'tahun' });
      if (error) throw error;
    },
    async loadItems(year) {
      const { data, error } = await client.from('items').select('*').eq('tahun', year).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => ({ id: r.id, kategori: r.kategori, judul: r.judul, deskripsi: r.deskripsi || '', tanggal: r.tanggal || '', meta: r.meta || {} }));
    },
    async saveItems(year, items) {
      const { error: delErr } = await client.from('items').delete().eq('tahun', year);
      if (delErr) throw delErr;
      if (!items.length) return;
      const rows = items.map((it) => clean({
        id: it.id, tahun: year, kategori: it.kategori, judul: it.judul,
        deskripsi: it.deskripsi || null, tanggal: it.tanggal || null, meta: it.meta || {},
      }));
      const { error } = await client.from('items').insert(rows);
      if (error) throw error;
    },
  };
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------- Hitung kelengkapan ---------- */
function groupCounts() {
  const counts = {};
  for (const g of GROUPS) counts[g.id] = 0;
  if (state.monografi && MONOGRAFI_FIELDS.some((f) => String(state.monografi[f] ?? '').trim() !== '')) counts.monografi = 1;
  for (const it of state.items) {
    const cat = CATEGORIES.find((c) => c.id === it.kategori);
    if (!cat) continue;
    counts[cat.group] = (counts[cat.group] || 0) + 1;
  }
  return counts;
}
function completeness() {
  const counts = groupCounts();
  const filled = GROUPS.filter((g) => counts[g.id] > 0).length;
  return { counts, filled, pct: Math.round((filled / GROUPS.length) * 100) };
}

/* ---------- Tabs ---------- */
function switchTab(name, { scroll = true } = {}) {
  if ((name === 'cetak' || name === 'pengguna') && !isAdmin()) { toast('Bagian ini hanya untuk admin.'); return; }
  state.tab = name;
  $$('.tab-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tab-panel').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
  const stage = $('#roadmapStage');
  if (stage) stage.hidden = name !== 'materi';
  if (name === 'rekap') renderRekap();
  if (name === 'cetak') renderCetak();
  if (name === 'pengguna') renderPengguna();
  if (name === 'beranda') renderBoard();
  if (scroll) window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/* ---------- Render: Beranda ---------- */
let displayedPct = 0;
function renderBoard() {
  const { counts, filled, pct } = completeness();
  const totalItems = state.items.length;
  const board = $('#completeBoard');
  board.innerHTML = GROUPS.map((g) => {
    const n = counts[g.id];
    const done = n > 0;
    const label = g.id === 'monografi' ? (done ? 'tersimpan' : 'belum diisi') : (done ? `${n} entri` : 'belum ada entri');
    return `<button type="button" class="board__item ${done ? 'board__item--done' : ''}" data-group="${g.id}">
      <span class="tick">✓</span>
      <span><b>${esc(g.name)}</b><span>${esc(g.hint)} · ${esc(label)}</span></span>
    </button>`;
  }).join('');
  $$('.board__item', board).forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.group;
    if (g === 'monografi') { switchTab('input'); $('#monografiForm').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
    const cat = CATEGORIES.find((c) => c.group === g);
    if (cat) { setCategory(cat.id); switchTab('input'); }
  }));

  $('#completeLabel').textContent = `${filled} dari ${GROUPS.length} kelompok terisi · ${totalItems} entri tercatat`;
  const bar = $('#completeBar');
  const wrap = $('#completeBarWrap');
  wrap.setAttribute('aria-valuenow', String(pct));
  requestAnimationFrame(() => { bar.style.width = pct + '%'; });

  // Count-up persen
  const el = $('#completePct');
  const from = displayedPct;
  displayedPct = pct;
  if (reducedMotion() || from === pct) { el.textContent = pct; return; }
  const t0 = performance.now();
  const dur = 900;
  const tick = (t) => {
    const k = clamp((t - t0) / dur);
    el.textContent = Math.round(from + (pct - from) * easeOutCubic(k));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Status langkah 01–04
  const steps = $$('.step-card');
  const hasIdentity = !!(state.settings && state.settings.kelurahan);
  const hasData = !!state.monografi || totalItems > 0;
  if (steps[0]) steps[0].classList.toggle('step-card--done', hasIdentity);
  if (steps[1]) steps[1].classList.toggle('step-card--done', hasData);
  if (steps[2]) steps[2].classList.toggle('step-card--done', pct === 100);
}

function fillIdentityForm() {
  const s = state.settings || DEFAULT_SETTINGS;
  const f = $('#identityForm');
  f.kelurahan.value = s.kelurahan || '';
  f.kecamatan.value = s.kecamatan || '';
  f.lurah_nama.value = s.lurah_nama || '';
  f.lurah_nip.value = s.lurah_nip || '';
  f.sek_nama.value = s.sek_nama || '';
  f.sek_nip.value = s.sek_nip || '';
}

function fillMonografiForm() {
  const m = state.monografi || {};
  const f = $('#monografiForm');
  for (const field of MONOGRAFI_FIELDS) {
    if (f[field]) f[field].value = m[field] ?? '';
  }
}

/* ---------- Render: Input Data ---------- */
function renderCatRail() {
  const counts = {};
  for (const it of state.items) counts[it.kategori] = (counts[it.kategori] || 0) + 1;
  const rail = $('#catRail');
  rail.innerHTML = CATEGORIES.map((c) => `
    <button type="button" class="cat-btn" data-cat="${c.id}" aria-pressed="${c.id === state.category}">
      <span class="cat-btn__num">${c.num}</span>
      <span class="cat-btn__name">${esc(c.name)}</span>
      <span class="cat-btn__count">${counts[c.id] || 0}</span>
    </button>`).join('');
  $$('.cat-btn', rail).forEach((b) => b.addEventListener('click', () => setCategory(b.dataset.cat)));
}

function setCategory(catId) {
  state.category = catId;
  state.editingId = null;
  renderCatRail();
  renderEntryForm();
  renderEntryList();
}

function renderEntryForm() {
  const cat = CATEGORIES.find((c) => c.id === state.category);
  $('#entryFormTitle').textContent = (state.editingId ? 'Ubah entri — ' : 'Tambah entri — ') + cat.name;
  $('#entryFormSub').textContent = cat.desc;
  const fields = $('#entryFields');
  const editing = state.editingId ? state.items.find((i) => i.id === state.editingId) : null;
  const meta = editing ? editing.meta || {} : {};
  let html = `
    <div class="field field--full">
      <label for="eJudul">Judul entri</label>
      <input id="eJudul" name="judul" type="text" required placeholder="cth. ${cat.id === 'surat_masuk' || cat.id === 'surat_keluar' ? 'Undangan rapat koordinasi' : 'Judul kegiatan / entri'}" value="${esc(editing ? editing.judul : '')}">
    </div>
    <div class="field">
      <label for="eTanggal">Tanggal</label>
      <input id="eTanggal" name="tanggal" type="date" value="${esc(editing ? editing.tanggal : '')}">
    </div>`;
  for (const m of cat.meta) {
    const val = meta[m.key] ?? '';
    if (m.type === 'select') {
      html += `<div class="field">
        <label for="eMeta_${m.key}">${esc(m.label)}</label>
        <select id="eMeta_${m.key}" name="meta_${m.key}">
          <option value="">— pilih —</option>
          ${m.options.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        </select>
      </div>`;
    } else {
      html += `<div class="field">
        <label for="eMeta_${m.key}">${esc(m.label)}</label>
        <input id="eMeta_${m.key}" name="meta_${m.key}" type="${m.type}" placeholder="${esc(m.placeholder || '')}" value="${esc(val)}">
      </div>`;
    }
  }
  html += `<div class="field field--full">
      <label for="eDeskripsi">Keterangan / deskripsi</label>
      <textarea id="eDeskripsi" name="deskripsi" placeholder="Keterangan tambahan, bila ada.">${esc(editing ? editing.deskripsi : '')}</textarea>
    </div>`;
  fields.innerHTML = html;
  $('#entrySubmitBtn').textContent = state.editingId ? 'Simpan perubahan' : 'Simpan entri';
  $('#entryCancelBtn').hidden = !state.editingId;
}

function metaChips(item) {
  const cat = CATEGORIES.find((c) => c.id === item.kategori);
  if (!cat) return '';
  const chips = [];
  for (const m of cat.meta) {
    const v = item.meta && item.meta[m.key];
    if (v !== undefined && String(v).trim() !== '') chips.push(`<span class="chip">${esc(m.label)}: ${esc(v)}</span>`);
  }
  return chips.join('');
}

function renderEntryList() {
  const list = $('#entryList');
  const items = state.items.filter((i) => i.kategori === state.category);
  if (!items.length) {
    list.innerHTML = `<div class="empty">Belum ada entri pada kategori ini. Tambah entri pertama lewat formulir di atas.</div>`;
    return;
  }
  list.innerHTML = items.map((it) => `
    <article class="entry">
      <div class="entry__body">
        <div class="entry__title">${esc(it.judul)}</div>
        <div class="entry__meta">${it.tanggal ? esc(it.tanggal) + ' · ' : ''}${esc(CATEGORIES.find((c) => c.id === it.kategori)?.name || '')}</div>
        ${it.deskripsi ? `<p class="entry__desc">${esc(it.deskripsi)}</p>` : ''}
        <div class="entry__chips">${metaChips(it)}</div>
      </div>
      <div class="entry__actions">
        <button type="button" class="icon-btn" data-edit="${it.id}">Ubah</button>
        <button type="button" class="icon-btn icon-btn--del" data-del="${it.id}">Hapus</button>
      </div>
    </article>`).join('');
  $$('[data-edit]', list).forEach((b) => b.addEventListener('click', () => startEdit(b.dataset.edit)));
  $$('[data-del]', list).forEach((b) => b.addEventListener('click', () => deleteEntry(b.dataset.del)));
}

function startEdit(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  state.category = it.kategori;
  state.editingId = id;
  renderCatRail();
  renderEntryForm();
  renderEntryList();
  $('#entryForm').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  $('#eJudul').focus();
}

async function deleteEntry(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  if (!confirm(`Hapus entri "${it.judul}"?`)) return;
  state.items = state.items.filter((i) => i.id !== id);
  if (state.editingId === id) { state.editingId = null; renderEntryForm(); }
  try {
    await state.store.saveItems(state.year, state.items);
    toast('Entri dihapus.');
  } catch (e) { toast('Gagal menghapus entri: ' + e.message); return; }
  renderCatRail();
  renderEntryList();
  renderBoard();
}

/* ---------- Render: Rekap ---------- */
function renderRekap() {
  const { counts, filled, pct } = completeness();
  const total = state.items.length;
  const masuk = state.items.filter((i) => i.kategori === 'surat_masuk').length;
  const keluar = state.items.filter((i) => i.kategori === 'surat_keluar').length;
  $('#statTotal').textContent = fmtNum(total);
  $('#statMasuk').textContent = fmtNum(masuk);
  $('#statKeluar').textContent = fmtNum(keluar);
  $('#statGroups').textContent = `${filled}/9`;

  // Donat
  const C = 439.8;
  const donut = $('#donutVal');
  $('#donutPct').textContent = pct + '%';
  requestAnimationFrame(() => { donut.style.strokeDashoffset = String(C * (1 - pct / 100)); });
  $('#donutLegend').innerHTML = GROUPS.map((g) => {
    const n = counts[g.id];
    const val = n > 0 ? (g.id === 'monografi' ? '✓ tersimpan' : '✓ ' + n + ' entri') : '— belum terisi';
    return `<div class="legend-row"><span>${esc(g.name)}</span><b>${esc(val)}</b></div>`;
  }).join('');

  // Grafik batang per kategori
  const catCounts = {};
  for (const it of state.items) catCounts[it.kategori] = (catCounts[it.kategori] || 0) + 1;
  const max = Math.max(1, ...Object.values(catCounts));
  $('#barChart').innerHTML = CATEGORIES.map((c) => {
    const n = catCounts[c.id] || 0;
    return `<div class="bar-row">
      <span class="bar-row__name">${esc(c.name)}</span>
      <span class="bar-track"><span class="bar-fill" data-w="${Math.round((n / max) * 100)}"></span></span>
      <span class="bar-row__n">${n}</span>
    </div>`;
  }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('#barChart .bar-fill').forEach((b) => { b.style.width = b.dataset.w + '%'; });
  }));
}

/* ---------- Render: Cetak Laporan Tahunan ---------- */
function itemsOf(catId) {
  return state.items.filter((i) => i.kategori === catId);
}
function listHtml(items, emptyText) {
  if (!items.length) return `<p><i>${esc(emptyText)}</i></p>`;
  return '<ul>' + items.map((it) => {
    const chips = [];
    for (const [k, v] of Object.entries(it.meta || {})) {
      const chip = fmtMetaChip(k, v);
      if (chip) chips.push(chip);
    }
    return `<li><b>${esc(it.judul)}</b>${it.tanggal ? ` — ${esc(it.tanggal)}` : ''}${chips.length ? ` (${chips.join('; ')})` : ''}${it.deskripsi ? `: ${esc(it.deskripsi)}` : ''}</li>`;
  }).join('') + '</ul>';
}
function suratTable(items, pihakLabel) {
  if (!items.length) return '<p><i>Belum ada surat pada tahun laporan ini.</i></p>';
  const rows = items.map((it) => `<tr>
    <td>${esc(it.meta?.nomor || '—')}</td>
    <td>${esc(it.tanggal || '—')}</td>
    <td>${esc(it.meta?.pengirim || it.meta?.penerima || '—')}</td>
    <td>${esc(it.meta?.perihal || it.judul)}</td>
  </tr>`).join('');
  return `<table><thead><tr><th>Nomor Surat</th><th>Tanggal</th><th>${esc(pihakLabel)}</th><th>Perihal</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function pbbSummary(items, year, kel) {
  if (!items.length) return '';
  const sum = (k) => items.reduce((a, it) => a + (Number(it.meta?.[k]) || 0), 0);
  const sppt = sum('jumlah_sppt');
  const target = sum('target');
  const real = sum('realisasi');
  const tung = sum('tunggakan');
  const pct = target > 0 ? Math.round((real / target) * 100) : 0;
  return `<p>Selama Tahun ${year}, Kelurahan ${esc(kel)} mencatat ${fmtNum(sppt)} SPPT PBB dengan target ${fmtRp(target)}, realisasi ${fmtRp(real)} (${fmtNum(pct)}%), dan tunggakan ${fmtRp(tung)}.</p>
  <table><tbody>
    <tr><td style="width:38%">Jumlah SPPT</td><td>${fmtNum(sppt)} SPPT</td></tr>
    <tr><td>Target PBB</td><td>${fmtRp(target)}</td></tr>
    <tr><td>Realisasi PBB</td><td>${fmtRp(real)} (${fmtNum(pct)}%)</td></tr>
    <tr><td>Tunggakan</td><td>${fmtRp(tung)}</td></tr>
  </tbody></table>`;
}

function renderCetak() {
  const s = state.settings || DEFAULT_SETTINGS;
  const m = state.monografi || {};
  const y = state.year;
  const kel = s.kelurahan || 'Kadomas';
  const kec = s.kecamatan || '........................';
  const totalPend = (Number(m.penduduk_l) || 0) + (Number(m.penduduk_p) || 0);
  const bab = (romawi, judul, inner) => `<h2>BAB ${romawi}</h2><h3>${judul}</h3>${inner}`;

  const monografiRows = [
    ['Luas wilayah', m.luas_wilayah ? `${fmtNum(m.luas_wilayah)} km²` : '—'],
    ['Jumlah lingkungan / dusun', m.jumlah_lingkungan ? fmtNum(m.jumlah_lingkungan) : '—'],
    ['Jumlah RW', m.jumlah_rw ? fmtNum(m.jumlah_rw) : '—'],
    ['Jumlah RT', m.jumlah_rt ? fmtNum(m.jumlah_rt) : '—'],
    ['Jumlah kepala keluarga (KK)', m.jumlah_kk ? fmtNum(m.jumlah_kk) : '—'],
    ['Penduduk laki-laki', m.penduduk_l ? fmtNum(m.penduduk_l) + ' jiwa' : '—'],
    ['Penduduk perempuan', m.penduduk_p ? fmtNum(m.penduduk_p) + ' jiwa' : '—'],
    ['Jumlah penduduk', totalPend ? fmtNum(totalPend) + ' jiwa' : '—'],
    ['Sarana pendidikan', m.sarana_pendidikan ? fmtNum(m.sarana_pendidikan) + ' unit' : '—'],
    ['Sarana kesehatan', m.sarana_kesehatan ? fmtNum(m.sarana_kesehatan) + ' unit' : '—'],
    ['Sarana ibadah', m.sarana_ibadah ? fmtNum(m.sarana_ibadah) + ' unit' : '—'],
    ['Batas wilayah Utara', m.batas_utara || '—'],
    ['Batas wilayah Selatan', m.batas_selatan || '—'],
    ['Batas wilayah Timur', m.batas_timur || '—'],
    ['Batas wilayah Barat', m.batas_barat || '—'],
  ];
  const monografiTable = m && MONOGRAFI_FIELDS.some((f) => String(m[f] ?? '').trim() !== '')
    ? `<table><tbody>${monografiRows.map(([k, v]) => `<tr><td style="width:38%">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>${m.keterangan ? `<p>${esc(m.keterangan)}</p>` : ''}`
    : '<p><i>Data monografi belum diisi untuk tahun laporan ini.</i></p>';

  const masuk = itemsOf('surat_masuk');
  const keluar = itemsOf('surat_keluar');

  $('#laporanDoc').innerHTML = `
    <div class="laporan-kop">
      <img class="kop-logo" src="logo-pandeglang.png" alt="Lambang Kabupaten Pandeglang">
      <div class="kop-text">
        <div class="kop-1">Pemerintah Kabupaten Pandeglang</div>
        <div class="kop-2">Kelurahan ${esc(kel)}</div>
        <div class="kop-3">Kecamatan ${esc(kec)}</div>
      </div>
    </div>
    <div class="laporan-title">
      <h1>Laporan Penyelenggaraan Pemerintahan Kelurahan</h1>
      <p>( Laporan Tahunan ) &nbsp; Tahun ${y}</p>
    </div>
    ${bab('I', 'Pendahuluan', `<p>Laporan Penyelenggaraan Pemerintahan Kelurahan ${esc(kel)}, Kecamatan ${esc(kec)}, Tahun ${y} ini disusun sebagai bentuk pertanggungjawaban penyelenggaraan pemerintahan kelurahan selama satu tahun anggaran. Laporan ini memuat monografi kelurahan, realisasi program kerja, pelayanan kepada masyarakat, pembangunan, pembinaan dan pemberdayaan masyarakat, kesehatan dan pendidikan, serta permasalahan, kendala, dan rencana tindak lanjut.</p><p>Laporan ini disampaikan kepada Camat sebagai bahan evaluasi dan pembinaan penyelenggaraan pemerintahan kelurahan.</p>`)}
    ${bab('II', 'Monografi Kelurahan', `<p>Data monografi Kelurahan ${esc(kel)} per 31 Desember ${y} adalah sebagai berikut:</p>${monografiTable}`)}
    ${bab('III', 'Realisasi Program Kerja', `
      ${listHtml(itemsOf('program_kerja'), 'Belum ada entri program kerja pada tahun laporan ini.')}
      <h3>Pajak Bumi dan Bangunan (PBB)</h3>
      ${pbbSummary(itemsOf('pbb'), y, kel)}
      ${listHtml(itemsOf('pbb'), 'Belum ada entri PBB pada tahun laporan ini.')}`)}
    ${bab('IV', 'Pelayanan', `
      <p>Selama Tahun ${y}, Kelurahan ${esc(kel)} mencatat ${fmtNum(itemsOf('pelayanan').length)} kegiatan pelayanan, ${fmtNum(masuk.length)} surat masuk, dan ${fmtNum(keluar.length)} surat keluar.</p>
      <h3>Pelayanan Administrasi</h3>
      ${listHtml(itemsOf('pelayanan'), 'Belum ada entri pelayanan pada tahun laporan ini.')}
      <h3>Surat Masuk</h3>
      ${suratTable(masuk, 'Pengirim')}
      <h3>Surat Keluar</h3>
      ${suratTable(keluar, 'Penerima')}`)}
    ${bab('V', 'Pembangunan', listHtml(itemsOf('pembangunan'), 'Belum ada entri pembangunan pada tahun laporan ini.'))}
    ${bab('VI', 'Pembinaan Kemasyarakatan', listHtml(itemsOf('pembinaan'), 'Belum ada entri pembinaan kemasyarakatan pada tahun laporan ini.'))}
    ${bab('VII', 'Pemberdayaan Masyarakat', listHtml(itemsOf('pemberdayaan'), 'Belum ada entri pemberdayaan masyarakat pada tahun laporan ini.'))}
    ${bab('VIII', 'Kesehatan dan Pendidikan', listHtml(itemsOf('kesehatan_pendidikan'), 'Belum ada entri kesehatan dan pendidikan pada tahun laporan ini.'))}
    ${bab('IX', 'Permasalahan, Kendala, dan Rencana Tindak Lanjut', `
      <h3>Permasalahan dan Kendala</h3>
      ${listHtml(itemsOf('permasalahan'), 'Belum ada entri permasalahan dan kendala pada tahun laporan ini.')}
      <h3>Rencana Tindak Lanjut</h3>
      ${listHtml(itemsOf('tindak_lanjut'), 'Belum ada entri rencana tindak lanjut pada tahun laporan ini.')}`)}
    <h2>Penutup</h2>
    <p>Demikian Laporan Penyelenggaraan Pemerintahan Kelurahan Tahun ${y} Kelurahan ${esc(kel)}, Kecamatan ${esc(kec)} ini disusun dengan sebenar-benarnya. Atas perhatian dan pembinaan Bapak/Ibu Camat, kami mengucapkan terima kasih.</p>
    <div class="laporan-sign">
      <div>
        <p>Mengetahui,<br>Lurah ${esc(kel)}</p>
        <div class="sign-space"></div>
        <p class="sign-name">${esc(s.lurah_nama || '( Nama Lurah )')}</p>
        <p>NIP. ${esc(s.lurah_nip || '........................')}</p>
      </div>
      <div>
        <p>Kelurahan ${esc(kel)}, Maret ${y + 1}<br>Sekretaris Lurah</p>
        <div class="sign-space"></div>
        <p class="sign-name">${esc(s.sek_nama || '( Nama Sekretaris Lurah )')}</p>
        <p>NIP. ${esc(s.sek_nip || '........................')}</p>
      </div>
    </div>`;
}

/* ---------- Reveals ---------- */
function watchReveals(root = document) {
  const reveal = (el) => el.classList.add('is-in');
  if (!('IntersectionObserver' in window)) {
    $$('[data-reveal]').forEach(reveal);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      reveal(e.target);
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  const watch = () => $$('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
  watch();
  const mo = new MutationObserver(watch);
  mo.observe(document.body, { childList: true, subtree: true });
  // Pengaman: bila observer gagal, tampilkan semua setelah 2 detik.
  setTimeout(() => $$('[data-reveal]:not(.is-in)').forEach(reveal), 2000);
}

/* ---------- Roadmap: satu rAF loop, self-drawing path ---------- */
// 0.00–0.10  tahap 1 tergambar · 0.10–0.26 tahap 2 · 0.26–0.42 tahap 3
// 0.42–0.58  tahap 4 · 0.58–0.74 tahap 5 · 0.74–0.92 tahap 6 · 0.92–1.00 tiba
const ROADMAP_WINDOW = [0.04, 0.96];
function startRoadmapLoop() {
  const stage = $('#roadmapStage');
  if (!stage) return;
  const legs = $$('.legs path', stage);
  const stations = $$('.station', stage);
  const rider = $('.rider', stage);
  const stepNum = $('#roadmapStepNum');
  const pctEl = $('#roadmapPct');
  const kicker = $('#roadmapKicker');
  const title = $('#roadmapStepTitle');
  const body = $('#roadmapStepBody');
  const bars = $$('#roadmapBars i');
  let lastP = -1;
  let current = -1;

  const render = (p) => {
    const u = range(p, ...ROADMAP_WINDOW) * legs.length; // 0 → 6
    const active = clamp(Math.floor(u), 0, legs.length - 1);
    legs.forEach((path, i) => {
      const k = easeOutCubic(clamp(u - i));
      path.style.strokeDashoffset = String(1 - k);
      if (i === active) {
        try {
          const len = path.getTotalLength();
          const pt = path.getPointAtLength(len * k);
          rider.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        } catch { /* abaikan */ }
      }
    });
    stations.forEach((st, i) => st.classList.toggle('station--done', u > i));
    pctEl.textContent = Math.round(clamp(u, 0, legs.length) / legs.length * 100) + '%';
    stepNum.textContent = String(active + 1);
    if (active !== current) {
      current = active;
      const s = ROADMAP_STEPS[active];
      kicker.textContent = s.kicker;
      title.textContent = s.title;
      body.textContent = s.body;
      bars.forEach((b, i) => b.classList.toggle('on', i <= active));
    }
  };

  const loop = () => {
    if (!stage.hidden) {
      const rect = stage.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.height > 0 && rect.bottom > 0 && rect.top < vh) {
        const p = clamp(-rect.top / Math.max(1, rect.height - vh));
        if (Math.abs(p - lastP) > 0.00005 || lastP < 0) {
          lastP = p;
          render(p);
        }
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* ---------- Ekspor / impor cadangan ---------- */
function exportBackup() {
  const payload = {
    app: 'laporan-tahunan', version: 1, year: state.year,
    settings: state.settings, monografi: state.monografi, items: state.items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `laporan-tahunan-cadangan-${state.year}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Cadangan diunduh.');
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !Array.isArray(data.items)) throw new Error('Format cadangan tidak dikenali.');
    state.settings = data.settings || null;
    state.monografi = data.monografi || null;
    state.items = data.items;
    await state.store.saveSettings(state.year, state.settings || {});
    await state.store.saveMonografi(state.year, state.monografi || {});
    await state.store.saveItems(state.year, state.items);
    fillIdentityForm();
    fillMonografiForm();
    renderCatRail();
    renderEntryForm();
    renderEntryList();
    renderBoard();
    toast('Cadangan dipulihkan.');
  } catch (e) {
    toast('Gagal memulihkan cadangan: ' + e.message);
  }
}

/* ---------- Muat data tahun ---------- */
async function loadYearData() {
  try {
    state.settings = await state.store.loadSettings(state.year);
    state.monografi = await state.store.loadMonografi(state.year);
    state.items = await state.store.loadItems(state.year);
  } catch (e) {
    toast('Gagal memuat data: ' + e.message);
    state.settings = null; state.monografi = null; state.items = [];
  }
  state.editingId = null;
  fillIdentityForm();
  fillMonografiForm();
  renderCatRail();
  renderEntryForm();
  renderEntryList();
  renderBoard();
  $$('.yearEcho').forEach((el) => { el.textContent = state.year; });
}

function setModeBadge(mode) {
  const b = $('#modeBadge');
  if (mode === 'supabase') {
    b.classList.add('mode-badge--shared');
    b.innerHTML = '<span class="dot"></span>Mode bersama · Supabase';
  } else {
    b.classList.remove('mode-badge--shared');
    b.innerHTML = '<span class="dot"></span>Mode lokal <span class="mode-badge__hint">— hubungkan Supabase untuk data bersama</span>';
  }
}

/* ---------- Events ---------- */
function bindEvents() {
  $$('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (!go) return;
    const dest = go.dataset.goto;
    if (dest === 'identity') { switchTab('beranda'); setTimeout(() => $('#identity').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }), 60); }
    else switchTab(dest);
  });

  $('#yearSelect').addEventListener('change', async (e) => {
    state.year = Number(e.target.value);
    await loadYearData();
    toast('Menampilkan data tahun ' + state.year + '.');
  });

  $('#identityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    state.settings = {
      kelurahan: f.kelurahan.value.trim(),
      kecamatan: f.kecamatan.value.trim(),
      lurah_nama: f.lurah_nama.value.trim(),
      lurah_nip: f.lurah_nip.value.trim(),
      sek_nama: f.sek_nama.value.trim(),
      sek_nip: f.sek_nip.value.trim(),
    };
    try {
      await state.store.saveSettings(state.year, state.settings);
      toast('Identitas tersimpan.');
    } catch (err) { toast('Gagal menyimpan identitas: ' + err.message); return; }
    renderBoard();
  });

  $('#monografiForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const v = {};
    for (const field of MONOGRAFI_FIELDS) v[field] = f[field] ? f[field].value.trim() : '';
    state.monografi = v;
    try {
      await state.store.saveMonografi(state.year, v);
      toast('Monografi tersimpan.');
    } catch (err) { toast('Gagal menyimpan monografi: ' + err.message); return; }
    renderBoard();
  });

  $('#entryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cat = CATEGORIES.find((c) => c.id === state.category);
    const fd = new FormData(e.target);
    const judul = String(fd.get('judul') || '').trim();
    if (!judul) { toast('Judul entri wajib diisi.'); return; }
    const meta = {};
    for (const m of cat.meta) {
      const v = String(fd.get('meta_' + m.key) || '').trim();
      if (v !== '') meta[m.key] = v;
    }
    const item = {
      id: state.editingId || uid(),
      kategori: cat.id,
      judul,
      tanggal: String(fd.get('tanggal') || ''),
      deskripsi: String(fd.get('deskripsi') || '').trim(),
      meta,
    };
    if (state.editingId) {
      const i = state.items.findIndex((x) => x.id === state.editingId);
      if (i >= 0) state.items[i] = item;
      state.editingId = null;
    } else {
      state.items.unshift(item);
    }
    try {
      await state.store.saveItems(state.year, state.items);
      toast('Entri tersimpan.');
    } catch (err) { toast('Gagal menyimpan entri: ' + err.message); return; }
    renderCatRail();
    renderEntryForm();
    renderEntryList();
    renderBoard();
  });

  $('#entryCancelBtn').addEventListener('click', () => {
    state.editingId = null;
    renderEntryForm();
  });

  $('#printBtn').addEventListener('click', () => window.print());
  $('#exportBtn').addEventListener('click', exportBackup);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importBackup(file);
    e.target.value = '';
  });
}

/* ---------- Portal login + peran (Supabase Auth) ---------- */
let sbClient = null;
let authUser = null;
let authProfile = null;
let authMode = 'login';
const authEnforced = () => !!sbClient;
const isAdmin = () => !authEnforced() || (authProfile && authProfile.role === 'admin' && authProfile.approved === true);

async function ensureProfile(client, user) {
  const { data } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (data) return data;
  const { count } = await client.from('profiles').select('*', { count: 'exact', head: true });
  const first = (count || 0) === 0;
  const row = { id: user.id, email: user.email || '', role: first ? 'admin' : 'user', approved: first };
  const { data: ins, error } = await client.from('profiles').insert(row).select().single();
  if (error) throw error;
  return ins;
}

async function loadAuthProfile() {
  authProfile = await ensureProfile(sbClient, authUser);
}

function showAuthState(which) {
  $('#authForm').hidden = which !== 'form';
  $('#authPending').hidden = which !== 'pending';
  $('#authCheckEmail').hidden = which !== 'check-email';
}

function refreshAuthUI() {
  const chip = $('#userChip');
  if (authUser && authProfile) {
    $('#userChipText').textContent = `${authUser.email} · ${authProfile.role === 'admin' ? 'Admin' : 'User'}`;
    chip.hidden = false;
  } else {
    chip.hidden = true;
  }
  const admin = isAdmin();
  $('#tabbtn-cetak').style.display = admin ? '' : 'none';
  $('#tabbtn-pengguna').style.display = admin ? '' : 'none';
  if (!admin && (state.tab === 'cetak' || state.tab === 'pengguna')) switchTab('beranda', { scroll: false });
  const idForm = $('#identityForm');
  $$('input, button[type="submit"]', idForm).forEach((el) => { el.disabled = !admin; });
  $('#importBtn').disabled = !admin;
  const note = $('#identityAdminNote');
  if (note) note.hidden = admin;
}

function applyAuthGate() {
  const locked = authEnforced() && !(authUser && authProfile && authProfile.approved);
  document.body.classList.toggle('locked', locked);
  if (!authUser) { showAuthState('form'); return; }
  if (!authProfile || !authProfile.approved) { showAuthState('pending'); return; }
  refreshAuthUI();
}

async function renderPengguna() {
  const list = $('#userList');
  if (!sbClient || !isAdmin()) { list.innerHTML = '<p><i>Hanya admin yang bisa melihat daftar pengguna.</i></p>'; return; }
  const { data, error } = await sbClient.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) { list.innerHTML = `<p><i>Gagal memuat pengguna: ${esc(error.message)}</i></p>`; return; }
  if (!data.length) { list.innerHTML = '<p><i>Belum ada pengguna.</i></p>'; return; }
  list.innerHTML = data.map((p) => `
    <div class="user-row" data-uid="${esc(p.id)}">
      <div class="user-row__who">
        <div class="user-row__email">${esc(p.email)}</div>
        <div class="user-row__meta">Terdaftar ${esc(String(p.created_at || '').slice(0, 10))}${p.id === (authUser && authUser.id) ? ' · ini kamu' : ''}</div>
      </div>
      <span class="pill ${p.approved ? 'pill--ok' : 'pill--wait'}">${p.approved ? 'Disetujui' : 'Menunggu'}</span>
      <label>Peran
        <select data-role>
          <option value="user" ${p.role === 'user' ? 'selected' : ''}>User</option>
          <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </label>
      <label><input type="checkbox" data-approved ${p.approved ? 'checked' : ''}> Disetujui</label>
      <button class="btn btn--sm" type="button" data-save>Simpan</button>
    </div>`).join('');
  $$('[data-save]', list).forEach((btn) => btn.addEventListener('click', async () => {
    const row = btn.closest('.user-row');
    const uid = row.dataset.uid;
    const role = row.querySelector('[data-role]').value;
    const approved = row.querySelector('[data-approved]').checked;
    btn.disabled = true;
    const { error: err } = await sbClient.from('profiles').update({ role, approved }).eq('id', uid);
    btn.disabled = false;
    if (err) { toast('Gagal menyimpan: ' + err.message); return; }
    toast('Pengguna diperbarui.');
    if (uid === (authUser && authUser.id)) { await loadAuthProfile(); applyAuthGate(); }
    renderPengguna();
  }));
}

function bindAuthEvents() {
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#authMsg');
    msg.textContent = '';
    msg.classList.remove('ok');
    if (!sbClient) { msg.textContent = 'Login memakai Supabase — server tidak terjangkau saat ini.'; return; }
    const email = $('#authEmail').value.trim();
    const pw = $('#authPassword').value;
    if (!email || pw.length < 6) { msg.textContent = 'Isi email yang benar dan kata sandi minimal 6 karakter.'; return; }
    const btn = $('#authSubmitBtn');
    btn.disabled = true;
    try {
      if (authMode === 'login') {
        const { error } = await sbClient.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { data, error } = await sbClient.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin } });
        if (error) throw error;
        if (data.user && !data.session) showAuthState('check-email');
      }
    } catch (err) {
      msg.textContent = err.message || 'Gagal. Coba lagi.';
    } finally {
      btn.disabled = false;
    }
  });
  $('#authToggleBtn').addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    $('#authSubmitBtn').textContent = authMode === 'login' ? 'Masuk' : 'Daftar';
    $('#authToggleBtn').textContent = authMode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk';
    $('#authPassword').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
    $('#authMsg').textContent = '';
  });
  const doLogout = async () => {
    if (sbClient) await sbClient.auth.signOut();
    authUser = null; authProfile = null;
    applyAuthGate();
  };
  $('#logoutBtn').addEventListener('click', doLogout);
  $('#authPendingLogoutBtn').addEventListener('click', doLogout);
  $('#authCheckEmailBackBtn').addEventListener('click', () => showAuthState('form'));
}

/* ---------- Boot ---------- */
function buildYearOptions() {
  const now = new Date().getFullYear();
  const sel = $('#yearSelect');
  sel.innerHTML = '';
  for (let y = now - 2; y <= now + 1; y++) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y;
    if (y === now) o.selected = true;
    sel.appendChild(o);
  }
  state.year = now;
}

async function boot() {
  buildYearOptions();
  state.store = createLocalStore();
  setModeBadge('local');

  const cfg = window.LAPORAN_CONFIG || {};
  const url = String(cfg.SUPABASE_URL || '').trim();
  const key = String(cfg.SUPABASE_ANON_KEY || '').trim();
  if (url && key) {
    try {
      const client = await loadSupabaseClient(url, key);
      sbClient = client;
      state.store = createSupabaseStore(client);
      setModeBadge('supabase');
    } catch (e) {
      toast('Supabase tidak terjangkau — memakai Mode lokal.');
    }
  }

  bindEvents();
  bindAuthEvents();

  if (authEnforced()) {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
      authUser = session.user;
      try { await loadAuthProfile(); } catch (e) { toast('Gagal memuat profil: ' + e.message); }
    }
    sbClient.auth.onAuthStateChange(async (_event, sess) => {
      authUser = sess ? sess.user : null;
      authProfile = null;
      if (authUser) { try { await loadAuthProfile(); } catch (e) { toast('Gagal memuat profil: ' + e.message); } }
      applyAuthGate();
      if (authUser && authProfile && authProfile.approved) {
        await loadYearData();
        renderRekap();
        renderCetak();
      }
    });
    applyAuthGate();
    if (authUser && authProfile && authProfile.approved) {
      await loadYearData();
      renderRekap();
      renderCetak();
    }
  } else {
    document.body.classList.remove('locked');
    await loadYearData();
    renderRekap();
    renderCetak();
  }
  watchReveals();
  startRoadmapLoop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

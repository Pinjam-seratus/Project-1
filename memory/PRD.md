# FinNota — Aplikasi Input Nota & Pelaporan Keuangan

## Problem Statement (asli)
Aplikasi untuk input nota berisi: tanggal nota, tanggal bayar, kode rekening, sumber dana (kasir, transfer, koperasi, pengembangan), kegiatan (operasional, pengembangan, lainnya), item barang, unit, harga per unit, total (unit×harga), dan total nota. Master data (kode rekening, kegiatan, item barang) dari import Excel atau input manual; item barang berupa dropdown dari database. Nomor nota manual, item bisa ditambah terus (Tambah Item), lalu Selesai. Laporan: pendapatan & pengeluaran, serta item per jenis sumber dana.

## User Choices
- Bahasa Indonesia, mata uang Rupiah (Rp).
- Login JWT username + password; admin bisa menambah user.
- Laporan tampil di layar + export Excel/PDF.

## Architecture
- Backend: FastAPI + MongoDB (motor). Semua route prefix `/api`.
- Auth: JWT via httpOnly cookie (username-based), bcrypt. Admin seed `admin/admin123`.
- Frontend: React (CRA) + Tailwind + shadcn/ui, recharts, xlsx + jsPDF (export client-side).

## Personas
- Admin keuangan: kelola semua data, user, laporan.
- User (operator): input nota, lihat laporan.

## Core Requirements (static)
- CRUD master data (kode-rekening/kegiatan/item-barang) + import Excel/CSV.
- Input nota dinamis (multi-item, total otomatis), nomor nota manual.
- Laporan pendapatan-pengeluaran & item per sumber dana + export Excel/PDF.
- Manajemen user (admin only), role enforcement.

## Implemented (2026-10-03, iter 2 — restructure sesuai contoh user)
- Struktur per-item: tiap item nota punya kode rekening & kategori sendiri; nomor nota/tanggal/sumber dana per-nota. ✅
- Kode Rekening format bertingkat (1.x=pendapatan, 2.x=belanja, + dialokasikan), jenis auto dari prefix kode, guard duplikat kode. ✅
- Item Barang master: NAMA BARANG + KODE REK + SUMBER REK(kategori); pilih item auto-isi kode rekening & kategori. ✅
- Sumber Dana jadi master data (K/TF/KOP/PENG, bisa tambah). Import Excel menyesuaikan header contoh user. ✅
- Laporan Pendapatan & Pengeluaran (section per kode rekening: PENDAPATAN/BELANJA/DIALOKASIKAN + TOTAL TRANSAKSI). ✅
- Laporan Rincian Belanja per Sumber Dana (detail per item, filter jenis/kode/kategori/sumber dana/tanggal). ✅
- Laporan Rincian Arus Kas per periode+sumber dana dgn input manual (modal awal, penjualan, setoran, dll) → Kas Belum Disetor. ✅
- Export Excel & PDF semua laporan. ✅
- Testing agent iter 2: backend 100% (25 tests), frontend 100% E2E. ✅

## Implemented (2026-10-03, iter 1)
- Auth username/password, master CRUD + import, input nota, daftar nota, dashboard, manajemen user.

## Backlog / Remaining
- P1: Sesuaikan detail layout Arus Kas 100% dgn contoh gambar bila user ingin baris spesifik (modal awal hari berikutnya dll).
- P2: 404 handling PUT/DELETE resource tidak ada.

## Next Tasks
- Tunggu feedback user atas laporan & import yang sudah disesuaikan.

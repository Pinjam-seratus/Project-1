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

## Implemented (2026-10-03)
- Auth username/password (login/logout/me), seed admin, role gating. ✅
- Master Data: tambah manual, edit, hapus, import CSV/XLSX, download template. ✅
- Input Nota: form lengkap, dropdown item dari master, tambah item, total realtime, jenis auto dari kode rekening. ✅
- Daftar Nota: list, detail, edit, hapus, pencarian. ✅
- Dashboard: stat pendapatan/pengeluaran/saldo/jumlah nota + grafik + nota terbaru. ✅
- Laporan: pendapatan-pengeluaran & item per sumber dana, filter tanggal, export Excel + PDF. ✅
- Manajemen User: CRUD (admin only). ✅
- Dark/light mode. ✅
- Testing agent: backend 100% (25 tests), frontend 100% E2E. ✅

## Backlog / Remaining
- P2: 404 handling untuk PUT /users/{id} & DELETE /nota/{id} saat record tidak ada.
- P2: Unique constraint kode rekening.
- P1: Sesuaikan parser import dengan format Excel asli user (menunggu contoh file).
- P1: Sesuaikan format laporan dengan contoh gambar laporan user (menunggu upload).

## Next Tasks
- Terima contoh Excel & gambar laporan dari user, sesuaikan kolom import & layout laporan.

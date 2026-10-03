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

## Implemented (2026-10-03, iter 3)
- Input Nota: user memasukkan TOTAL HARGA per item; harga/unit otomatis = total ÷ unit. ✅
- Rekap Bulanan: grafik tren pendapatan vs belanja per bulan di Dashboard (/api/reports/rekap-bulanan). ✅
- Arus Kas diperluas: Saldo Awal + lini penjualan/penambahan modal/pendapatan lainnya/kas bln lalu/sponsor + setoran ke kasir/bank/koperasi + belanja dana pengembangan → Saldo Akhir = saldo awal + penambahan − pengeluaran. ✅
- Testing iter 3: backend 26/26, frontend E2E 100%. ✅

## Backlog / Remaining (Arus Kas fidelitas penuh — menunggu konfirmasi user)
- Laporan RINGKASAN Arus Kas per akun (Kas Kasir / Rekening Bank / Rekening Koperasi) dgn Saldo Awal/Bertambah/Berkurang/Saldo Akhir + Selisih & penjelasan.
- Kegiatan Investasi (Dana Pengembangan) & Kegiatan Pemegang Saham (deviden) sesuai Excel.
- Transfer antar-dana (setoran dari/ke kasir/bank/koperasi) terhubung otomatis antar akun.
- Carryover saldo awal otomatis dari saldo akhir bulan sebelumnya.

## Implemented sebelumnya (iter 1 & 2)
- Auth username/password, master data (kode rekening/kategori/item/sumber dana) + import, nota per-item, daftar nota, laporan pendapatan-pengeluaran & rincian belanja, manajemen user.

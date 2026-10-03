import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, FileText, Loader2, TrendingUp, TrendingDown, Wallet, Save } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function Laporan() {
  const [tab, setTab] = useState("pp");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [fSumber, setFSumber] = useState("all");
  const [fKategori, setFKategori] = useState("all");
  const [fKode, setFKode] = useState("all");
  const [fJenis, setFJenis] = useState("belanja");
  const [loading, setLoading] = useState(false);

  const [sumberDana, setSumberDana] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [kodeList, setKodeList] = useState([]);
  const sdName = (kode) => sumberDana.find((s) => s.kode === kode)?.nama || kode;

  const [pp, setPp] = useState(null);
  const [rincian, setRincian] = useState(null);

  // arus kas state
  const [periode, setPeriode] = useState(thisMonth());
  const [akSumber, setAkSumber] = useState("");
  const [arusKas, setArusKas] = useState(null);
  const [akInput, setAkInput] = useState(null);
  const [akLoading, setAkLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [sd, kg, kr] = await Promise.all([
        api.get("/master/sumber-dana"), api.get("/master/kegiatan"), api.get("/master/kode-rekening"),
      ]);
      setSumberDana(sd.data); setKategoriList(kg.data); setKodeList(kr.data);
      if (sd.data[0]) setAkSumber(sd.data[0].kode);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (start) params.start = start;
      if (end) params.end = end;
      if (fSumber !== "all") params.sumber_dana = fSumber;
      if (fKategori !== "all") params.kategori = fKategori;
      const [a, b] = await Promise.all([
        api.get("/reports/pendapatan-pengeluaran", { params }),
        api.get("/reports/rincian-belanja", { params: { ...params, ...(fKode !== "all" ? { kode_rekening: fKode } : {}), ...(fJenis !== "all" ? { jenis: fJenis } : {}) } }),
      ]);
      setPp(a.data);
      setRincian(b.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // ---- Arus Kas ----
  const loadArusKas = async () => {
    if (!akSumber) return;
    setAkLoading(true);
    try {
      const [r, inp] = await Promise.all([
        api.get("/reports/arus-kas", { params: { periode, sumber_dana: akSumber } }),
        api.get("/arus-kas-input", { params: { periode, sumber_dana: akSumber } }),
      ]);
      setArusKas(r.data.groups[0] || null);
      setAkInput({
        modal_awal: inp.data.modal_awal || 0, penjualan: inp.data.penjualan || 0,
        penambahan_modal: inp.data.penambahan_modal || 0,
        kas_bulan_lalu_belum_disetor: inp.data.kas_bulan_lalu_belum_disetor || 0,
        sponsor_sisa: inp.data.sponsor_sisa || 0, penambahan_lain: inp.data.penambahan_lain || 0,
        setoran_kas_bulan_lalu: inp.data.setoran_kas_bulan_lalu || 0,
        setoran_kas_bulan_ini: inp.data.setoran_kas_bulan_ini || 0,
      });
    } finally {
      setAkLoading(false);
    }
  };
  useEffect(() => { if (tab === "aruskas" && akSumber) loadArusKas(); /* eslint-disable-next-line */ }, [tab, akSumber, periode]);

  const saveArusKas = async () => {
    try {
      await api.post("/arus-kas-input", { periode, sumber_dana: akSumber, ...akInput });
      toast.success("Data arus kas disimpan");
      loadArusKas();
    } catch (err) {
      toast.error(formatApiError(err, "Gagal menyimpan"));
    }
  };

  // ---- Exports ----
  const exportPPExcel = () => {
    if (!pp) return;
    const wb = XLSX.utils.book_new();
    const rowsOf = (list, label) => list.map((r) => ({ KODE: r.kode, "NAMA REKENING": r.nama, NILAI: r.nilai }));
    const all = [
      { KODE: "PENDAPATAN", "NAMA REKENING": "", NILAI: "" }, ...rowsOf(pp.pendapatan),
      { KODE: "", "NAMA REKENING": "TOTAL PENDAPATAN", NILAI: pp.total_pendapatan },
      { KODE: "BELANJA", "NAMA REKENING": "", NILAI: "" }, ...rowsOf(pp.belanja),
      { KODE: "", "NAMA REKENING": "TOTAL BELANJA", NILAI: pp.total_belanja },
      { KODE: "DIALOKASIKAN", "NAMA REKENING": "", NILAI: "" }, ...rowsOf(pp.dialokasikan),
      { KODE: "", "NAMA REKENING": "TOTAL TRANSAKSI", NILAI: pp.total_transaksi },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), "Pendapatan-Pengeluaran");
    XLSX.writeFile(wb, "laporan-pendapatan-pengeluaran.xlsx");
    toast.success("Excel diunduh");
  };

  const exportPPPdf = () => {
    if (!pp) return;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text("Laporan Pendapatan & Pengeluaran", 14, 16);
    doc.setFontSize(9);
    doc.text(start || end ? `Periode: ${start || "awal"} s/d ${end || "sekarang"}` : "Periode: Semua", 14, 22);
    const section = (title, list, total, color) => {
      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 24) + 6,
        head: [[title, "", "NILAI"]],
        body: [...list.map((r) => [r.kode, r.nama, formatRupiah(r.nilai)]), ["", "TOTAL", formatRupiah(total)]],
        styles: { fontSize: 8 }, headStyles: { fillColor: color },
      });
    };
    section("PENDAPATAN", pp.pendapatan, pp.total_pendapatan, [16, 185, 129]);
    section("BELANJA", pp.belanja, pp.total_belanja, [244, 63, 94]);
    if (pp.dialokasikan.length) section("DIALOKASIKAN", pp.dialokasikan, pp.total_dialokasikan, [217, 119, 6]);
    doc.setFontSize(11);
    doc.text(`TOTAL TRANSAKSI: ${formatRupiah(pp.total_transaksi)}`, 14, (doc.lastAutoTable?.finalY || 30) + 10);
    doc.save("laporan-pendapatan-pengeluaran.pdf");
    toast.success("PDF diunduh");
  };

  const exportRincianExcel = () => {
    if (!rincian) return;
    const wb = XLSX.utils.book_new();
    rincian.groups.forEach((g) => {
      const ws = XLSX.utils.json_to_sheet(g.items.map((it) => ({
        "Tgl Bayar": it.tanggal_bayar, "Tgl Transaksi": it.tanggal_nota, "Nomor Nota": it.nomor_nota,
        "Kode Rekening": it.kode_rekening, "Sumber Dana": sdName(g.sumber_dana), "Kategori": it.kategori,
        "Rincian Belanja": it.nama, "Unit": it.unit, "Harga": it.harga_per_unit, "Jumlah": it.total,
      })));
      XLSX.utils.book_append_sheet(wb, ws, sdName(g.sumber_dana).slice(0, 31));
    });
    XLSX.writeFile(wb, "laporan-rincian-belanja.xlsx");
    toast.success("Excel diunduh");
  };

  const exportRincianPdf = () => {
    if (!rincian) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text("Laporan Rincian Belanja per Sumber Dana", 14, 16);
    let y = 22;
    rincian.groups.forEach((g) => {
      doc.setFontSize(10); doc.text(`${sdName(g.sumber_dana)} — ${formatRupiah(g.total)}`, 14, y + 4);
      autoTable(doc, {
        startY: y + 6,
        head: [["Tgl Bayar", "Tgl Transaksi", "No Nota", "Kode Rek", "Kategori", "Rincian", "Unit", "Harga", "Jumlah"]],
        body: g.items.map((it) => [it.tanggal_bayar || "-", it.tanggal_nota, it.nomor_nota, it.kode_rekening, it.kategori, it.nama, it.unit, formatRupiah(it.harga_per_unit), formatRupiah(it.total)]),
        styles: { fontSize: 7 }, headStyles: { fillColor: [2, 132, 199] },
      });
      y = doc.lastAutoTable.finalY + 6;
    });
    doc.save("laporan-rincian-belanja.pdf");
    toast.success("PDF diunduh");
  };

  const Section = ({ title, rows, total, tone }) => (
    <Card className="overflow-hidden">
      <div className={`px-4 py-3 font-heading font-semibold text-sm ${tone}`}>{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground border-b border-border">
              <th className="text-left font-semibold text-xs uppercase px-4 py-2.5 w-24">Kode</th>
              <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">Nama Rekening</th>
              <th className="text-right font-semibold text-xs uppercase px-4 py-2.5">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-6 text-muted-foreground text-sm">Tidak ada data</td></tr>
            ) : rows.map((r) => (
              <tr key={r.kode} className="border-b border-border hover:bg-muted/30">
                <td className="px-4 py-2.5 font-mono">{r.kode}</td>
                <td className="px-4 py-2.5">{r.nama}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.nilai ? formatRupiah(r.nilai) : "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/80 font-bold">
              <td colSpan={2} className="px-4 py-2.5 text-right">TOTAL</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatRupiah(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">Laporan Keuangan</h2>
        <p className="text-sm text-muted-foreground mt-1">Pendapatan & pengeluaran, rincian belanja per sumber dana, dan arus kas</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pp" data-testid="tab-laporan-pp">Pendapatan & Pengeluaran</TabsTrigger>
          <TabsTrigger value="rincian" data-testid="tab-laporan-rincian">Rincian Belanja / Sumber Dana</TabsTrigger>
          <TabsTrigger value="aruskas" data-testid="tab-laporan-aruskas">Rincian Arus Kas</TabsTrigger>
        </TabsList>

        {/* Filters (pp + rincian) */}
        {(tab === "pp" || tab === "rincian") && (
          <Card className="p-4 mt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dari Tanggal</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="filter-start" className="w-40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sampai Tanggal</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="filter-end" className="w-40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sumber Dana</Label>
                <Select value={fSumber} onValueChange={setFSumber}>
                  <SelectTrigger data-testid="filter-sumber" className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Sumber Dana</SelectItem>
                    {sumberDana.map((s) => <SelectItem key={s.id} value={s.kode}>{s.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategori</Label>
                <Select value={fKategori} onValueChange={setFKategori}>
                  <SelectTrigger data-testid="filter-kategori" className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {kategoriList.map((k) => <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {tab === "rincian" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Kode Rekening</Label>
                  <Select value={fKode} onValueChange={setFKode}>
                    <SelectTrigger data-testid="filter-kode" className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kode</SelectItem>
                      {kodeList.map((k) => <SelectItem key={k.id} value={k.kode}>{k.kode} — {k.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {tab === "rincian" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Jenis</Label>
                  <Select value={fJenis} onValueChange={setFJenis}>
                    <SelectTrigger data-testid="filter-jenis" className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="belanja">Belanja</SelectItem>
                      <SelectItem value="pendapatan">Pendapatan</SelectItem>
                      <SelectItem value="dialokasikan">Dialokasikan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={load} data-testid="btn-terapkan-filter">Terapkan</Button>
              <Button variant="ghost" onClick={() => { setStart(""); setEnd(""); setFSumber("all"); setFKategori("all"); setFKode("all"); setFJenis("belanja"); setTimeout(load, 0); }} data-testid="btn-reset-filter">Reset</Button>
            </div>
          </Card>
        )}

        <TabsContent value="pp" className="mt-4 space-y-4">
          {loading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4 border-l-4 border-l-emerald-500" data-testid="laporan-stat-pendapatan">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><TrendingUp className="h-4 w-4" /> Total Pendapatan</div>
                  <p className="font-mono font-bold text-xl mt-2 text-emerald-600 dark:text-emerald-400 tabular-nums">{formatRupiah(pp?.total_pendapatan)}</p>
                </Card>
                <Card className="p-4 border-l-4 border-l-rose-500" data-testid="laporan-stat-belanja">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><TrendingDown className="h-4 w-4" /> Total Belanja</div>
                  <p className="font-mono font-bold text-xl mt-2 text-rose-600 dark:text-rose-400 tabular-nums">{formatRupiah(pp?.total_belanja)}</p>
                </Card>
                <Card className="p-4 border-l-4 border-l-sky-500" data-testid="laporan-stat-transaksi">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><Wallet className="h-4 w-4" /> Total Transaksi</div>
                  <p className="font-mono font-bold text-xl mt-2 text-sky-600 dark:text-sky-400 tabular-nums">{formatRupiah(pp?.total_transaksi)}</p>
                </Card>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button onClick={exportPPExcel} data-testid="btn-export-excel" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
                <Button onClick={exportPPPdf} data-testid="btn-export-pdf" className="bg-rose-600 hover:bg-rose-700 text-white gap-2"><FileText className="h-4 w-4" /> Export PDF</Button>
              </div>
              {pp && <Section title="1. PENDAPATAN" rows={pp.pendapatan} total={pp.total_pendapatan} tone="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" />}
              {pp && <Section title="2. BELANJA" rows={pp.belanja} total={pp.total_belanja} tone="bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300" />}
              {pp && pp.dialokasikan.length > 0 && <Section title="DIALOKASIKAN" rows={pp.dialokasikan} total={pp.total_dialokasikan} tone="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" />}
              {pp && (
                <Card className="p-4 flex items-center justify-between bg-primary text-primary-foreground">
                  <span className="font-heading font-bold">TOTAL TRANSAKSI</span>
                  <span className="font-mono font-bold text-xl tabular-nums">{formatRupiah(pp.total_transaksi)}</span>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="rincian" className="mt-4 space-y-4">
          {loading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div> : (
            <>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button onClick={exportRincianExcel} data-testid="btn-export-rincian-excel" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
                <Button onClick={exportRincianPdf} data-testid="btn-export-rincian-pdf" className="bg-rose-600 hover:bg-rose-700 text-white gap-2"><FileText className="h-4 w-4" /> Export PDF</Button>
              </div>
              {(rincian?.groups || []).length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground text-sm">Tidak ada data belanja.</Card>
              ) : rincian.groups.map((g) => (
                <Card key={g.sumber_dana} className="overflow-hidden" data-testid={`group-${g.sumber_dana}`}>
                  <div className="px-4 py-3 flex items-center justify-between bg-muted/60">
                    <span className="font-heading font-semibold text-sm">Sumber Dana: {sdName(g.sumber_dana)}</span>
                    <Badge variant="outline" className="font-mono tabular-nums">{formatRupiah(g.total)}</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-muted/30 text-muted-foreground border-b border-border">
                          <th className="text-left font-semibold text-xs uppercase px-3 py-2.5">Tgl Bayar</th>
                          <th className="text-left font-semibold text-xs uppercase px-3 py-2.5">Tgl Transaksi</th>
                          <th className="text-left font-semibold text-xs uppercase px-3 py-2.5">No Nota</th>
                          <th className="text-left font-semibold text-xs uppercase px-3 py-2.5">Kode Rek</th>
                          <th className="text-left font-semibold text-xs uppercase px-3 py-2.5">Kategori</th>
                          <th className="text-left font-semibold text-xs uppercase px-3 py-2.5">Rincian Belanja</th>
                          <th className="text-right font-semibold text-xs uppercase px-3 py-2.5">Unit</th>
                          <th className="text-right font-semibold text-xs uppercase px-3 py-2.5">Harga</th>
                          <th className="text-right font-semibold text-xs uppercase px-3 py-2.5">Jumlah</th>
                          <th className="text-right font-semibold text-xs uppercase px-3 py-2.5">Jml/Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((it, i) => (
                          <tr key={i} className="border-b border-border hover:bg-muted/30">
                            <td className="px-3 py-2.5 text-muted-foreground">{formatTanggal(it.tanggal_bayar)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatTanggal(it.tanggal_nota)}</td>
                            <td className="px-3 py-2.5 font-medium">{it.nomor_nota}</td>
                            <td className="px-3 py-2.5 font-mono">{it.kode_rekening}</td>
                            <td className="px-3 py-2.5 capitalize">{it.kategori}</td>
                            <td className="px-3 py-2.5">{it.nama}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{it.unit}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(it.harga_per_unit)}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatRupiah(it.total)}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold">{it.jumlah_per_nota != null ? formatRupiah(it.jumlah_per_nota) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="aruskas" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Periode (Bulan)</Label>
                <Input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} data-testid="ak-periode" className="w-44" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sumber Dana</Label>
                <Select value={akSumber || undefined} onValueChange={setAkSumber}>
                  <SelectTrigger data-testid="ak-sumber" className="w-48"><SelectValue placeholder="Pilih sumber dana" /></SelectTrigger>
                  <SelectContent>
                    {sumberDana.map((s) => <SelectItem key={s.id} value={s.kode}>{s.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {akLoading || !akInput ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Input manual */}
              <Card className="p-5 space-y-3">
                <h3 className="font-heading font-semibold text-sm">Input Penambahan & Setoran (Manual)</h3>
                {[
                  ["modal_awal", "Modal Awal"], ["penjualan", "Penjualan"], ["penambahan_modal", "Penambahan Modal"],
                  ["kas_bulan_lalu_belum_disetor", "Kas Bulan Lalu Belum Disetor"], ["sponsor_sisa", "Sponsor / Sisa Kembalian"],
                  ["penambahan_lain", "Penambahan Lain"], ["setoran_kas_bulan_lalu", "Setoran Kas Bulan Lalu"],
                  ["setoran_kas_bulan_ini", "Setoran Kas Bulan Ini"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label className="text-xs flex-1">{label}</Label>
                    <Input type="number" value={akInput[key]} onChange={(e) => setAkInput((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                      data-testid={`ak-input-${key}`} className="w-40 h-9 text-right font-mono" />
                  </div>
                ))}
                <Button onClick={saveArusKas} data-testid="btn-simpan-aruskas" className="w-full gap-2 mt-2"><Save className="h-4 w-4" /> Simpan</Button>
              </Card>

              {/* Report */}
              <Card className="p-5 space-y-3" data-testid="aruskas-report">
                <h3 className="font-heading font-semibold text-sm">Arus Kas — {sdName(akSumber)} ({periode})</h3>
                <div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1">Penambahan</p>
                  {arusKas && Object.entries({
                    "Modal Awal": arusKas.penambahan.modal_awal, "Penjualan": arusKas.penambahan.penjualan,
                    "Penambahan Modal": arusKas.penambahan.penambahan_modal,
                    "Kas Bln Lalu Blm Disetor": arusKas.penambahan.kas_bulan_lalu_belum_disetor,
                    "Sponsor / Sisa": arusKas.penambahan.sponsor_sisa, "Penambahan Lain": arusKas.penambahan.penambahan_lain,
                  }).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-muted-foreground">{k}</span><span className="font-mono tabular-nums">{formatRupiah(v)}</span></div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1"><span>Jumlah Penambahan</span><span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(arusKas?.jumlah_penambahan)}</span></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase mb-1">Pengeluaran (Belanja)</p>
                  {(arusKas?.belanja || []).map((b) => (
                    <div key={b.kode} className="flex justify-between text-sm py-0.5"><span className="text-muted-foreground"><span className="font-mono">{b.kode}</span> {b.nama}</span><span className="font-mono tabular-nums">{formatRupiah(b.nilai)}</span></div>
                  ))}
                  <div className="flex justify-between text-sm py-0.5"><span className="text-muted-foreground">Setoran Kas Bulan Lalu</span><span className="font-mono tabular-nums">{formatRupiah(arusKas?.setoran_kas_bulan_lalu)}</span></div>
                  <div className="flex justify-between text-sm py-0.5"><span className="text-muted-foreground">Setoran Kas Bulan Ini</span><span className="font-mono tabular-nums">{formatRupiah(arusKas?.setoran_kas_bulan_ini)}</span></div>
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1"><span>Jumlah Pengeluaran</span><span className="font-mono tabular-nums text-rose-600 dark:text-rose-400">{formatRupiah(arusKas?.jumlah_pengeluaran)}</span></div>
                </div>
                <div className="flex justify-between font-bold bg-primary text-primary-foreground rounded-lg px-4 py-3">
                  <span>Kas Belum Disetor</span><span className="font-mono tabular-nums" data-testid="ak-kas-belum-disetor">{formatRupiah(arusKas?.kas_belum_disetor)}</span>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

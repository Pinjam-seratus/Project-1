import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const sumberDanaLabel = { kasir: "Kasir", transfer: "Transfer", koperasi: "Koperasi", pengembangan: "Pengembangan" };

export default function Laporan() {
  const [tab, setTab] = useState("pendapatan-pengeluaran");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [pp, setPp] = useState(null);
  const [itemSumber, setItemSumber] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (start) params.start = start;
      if (end) params.end = end;
      const [a, b] = await Promise.all([
        api.get("/reports/pendapatan-pengeluaran", { params }),
        api.get("/reports/item-per-sumber-dana", { params }),
      ]);
      setPp(a.data);
      setItemSumber(b.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // ---- Export helpers ----
  const exportPPExcel = () => {
    if (!pp) return;
    const wb = XLSX.utils.book_new();
    const mk = (list) => list.map((n) => ({
      "Nomor Nota": n.nomor_nota, "Tanggal": n.tanggal_nota, "Kode Rekening": n.kode_rekening_nama,
      "Sumber Dana": n.sumber_dana, "Kegiatan": n.kegiatan, "Total": n.total_nota,
    }));
    const wsP = XLSX.utils.json_to_sheet(mk(pp.pendapatan));
    const wsE = XLSX.utils.json_to_sheet(mk(pp.pengeluaran));
    XLSX.utils.book_append_sheet(wb, wsP, "Pendapatan");
    XLSX.utils.book_append_sheet(wb, wsE, "Pengeluaran");
    const sum = XLSX.utils.json_to_sheet([
      { Keterangan: "Total Pendapatan", Nilai: pp.total_pendapatan },
      { Keterangan: "Total Pengeluaran", Nilai: pp.total_pengeluaran },
      { Keterangan: "Saldo", Nilai: pp.saldo },
    ]);
    XLSX.utils.book_append_sheet(wb, sum, "Ringkasan");
    XLSX.writeFile(wb, "laporan-pendapatan-pengeluaran.xlsx");
    toast.success("Excel berhasil diunduh");
  };

  const exportPPPdf = () => {
    if (!pp) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Laporan Pendapatan & Pengeluaran", 14, 16);
    doc.setFontSize(9);
    const period = start || end ? `Periode: ${start || "awal"} s/d ${end || "sekarang"}` : "Periode: Semua";
    doc.text(period, 14, 22);

    const body = (list) => list.map((n) => [n.nomor_nota, n.tanggal_nota, n.kode_rekening_nama, n.sumber_dana, n.kegiatan, formatRupiah(n.total_nota)]);
    autoTable(doc, {
      startY: 28, head: [["No Nota", "Tanggal", "Kode Rekening", "Sumber", "Kegiatan", "Total"]],
      body: body(pp.pendapatan), styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] },
      didDrawPage: (d) => doc.text("PENDAPATAN", 14, d.cursor.y ? 27 : 27),
    });
    let y = doc.lastAutoTable.finalY + 8;
    doc.text("PENGELUARAN", 14, y);
    autoTable(doc, {
      startY: y + 2, head: [["No Nota", "Tanggal", "Kode Rekening", "Sumber", "Kegiatan", "Total"]],
      body: body(pp.pengeluaran), styles: { fontSize: 8 }, headStyles: { fillColor: [244, 63, 94] },
    });
    y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Total Pendapatan: ${formatRupiah(pp.total_pendapatan)}`, 14, y);
    doc.text(`Total Pengeluaran: ${formatRupiah(pp.total_pengeluaran)}`, 14, y + 6);
    doc.text(`Saldo: ${formatRupiah(pp.saldo)}`, 14, y + 12);
    doc.save("laporan-pendapatan-pengeluaran.pdf");
    toast.success("PDF berhasil diunduh");
  };

  const exportItemExcel = () => {
    if (!itemSumber) return;
    const wb = XLSX.utils.book_new();
    itemSumber.groups.forEach((g) => {
      const ws = XLSX.utils.json_to_sheet(g.items.map((it) => ({
        "Nomor Nota": it.nomor_nota, "Tanggal": it.tanggal_nota, "Jenis": it.jenis,
        "Kegiatan": it.kegiatan, "Item": it.nama, "Unit": it.unit,
        "Harga/Unit": it.harga_per_unit, "Total": it.total,
      })));
      XLSX.utils.book_append_sheet(wb, ws, (sumberDanaLabel[g.sumber_dana] || g.sumber_dana).slice(0, 31));
    });
    XLSX.writeFile(wb, "laporan-item-per-sumber-dana.xlsx");
    toast.success("Excel berhasil diunduh");
  };

  const exportItemPdf = () => {
    if (!itemSumber) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Laporan Item per Sumber Dana", 14, 16);
    let y = 24;
    itemSumber.groups.forEach((g) => {
      doc.setFontSize(10);
      doc.text(`${sumberDanaLabel[g.sumber_dana] || g.sumber_dana} — ${formatRupiah(g.total)}`, 14, y);
      autoTable(doc, {
        startY: y + 2,
        head: [["No Nota", "Tanggal", "Item", "Unit", "Harga", "Total"]],
        body: g.items.map((it) => [it.nomor_nota, it.tanggal_nota, it.nama, it.unit, formatRupiah(it.harga_per_unit), formatRupiah(it.total)]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [2, 132, 199] },
      });
      y = doc.lastAutoTable.finalY + 8;
    });
    doc.save("laporan-item-per-sumber-dana.pdf");
    toast.success("PDF berhasil diunduh");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">Laporan Keuangan</h2>
        <p className="text-sm text-muted-foreground mt-1">Laporan pendapatan-pengeluaran & item per sumber dana</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="filter-start" className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="filter-end" className="w-40" />
          </div>
          <Button onClick={load} data-testid="btn-terapkan-filter">Terapkan</Button>
          <Button variant="ghost" onClick={() => { setStart(""); setEnd(""); setTimeout(load, 0); }} data-testid="btn-reset-filter">Reset</Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pendapatan-pengeluaran" data-testid="tab-laporan-pp">Pendapatan & Pengeluaran</TabsTrigger>
            <TabsTrigger value="item-sumber-dana" data-testid="tab-laporan-item">Item per Sumber Dana</TabsTrigger>
          </TabsList>

          <TabsContent value="pendapatan-pengeluaran" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border-l-4 border-l-emerald-500" data-testid="laporan-stat-pendapatan">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><TrendingUp className="h-4 w-4" /> Pendapatan</div>
                <p className="font-mono font-bold text-xl mt-2 text-emerald-600 dark:text-emerald-400 tabular-nums">{formatRupiah(pp?.total_pendapatan)}</p>
              </Card>
              <Card className="p-4 border-l-4 border-l-rose-500" data-testid="laporan-stat-pengeluaran">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><TrendingDown className="h-4 w-4" /> Pengeluaran</div>
                <p className="font-mono font-bold text-xl mt-2 text-rose-600 dark:text-rose-400 tabular-nums">{formatRupiah(pp?.total_pengeluaran)}</p>
              </Card>
              <Card className="p-4 border-l-4 border-l-sky-500" data-testid="laporan-stat-saldo">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><Wallet className="h-4 w-4" /> Saldo</div>
                <p className="font-mono font-bold text-xl mt-2 text-sky-600 dark:text-sky-400 tabular-nums">{formatRupiah(pp?.saldo)}</p>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={exportPPExcel} data-testid="btn-export-excel" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
              <Button onClick={exportPPPdf} data-testid="btn-export-pdf" className="bg-rose-600 hover:bg-rose-700 text-white gap-2"><FileText className="h-4 w-4" /> Export PDF</Button>
            </div>

            {["pendapatan", "pengeluaran"].map((jenis) => (
              <Card key={jenis} className="overflow-hidden">
                <div className={`px-4 py-3 font-heading font-semibold text-sm ${jenis === "pendapatan" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                  {jenis === "pendapatan" ? "Pendapatan" : "Pengeluaran"}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">No Nota</th>
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">Tanggal</th>
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">Kode Rekening</th>
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">Sumber</th>
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">Kegiatan</th>
                        <th className="text-right font-semibold text-xs uppercase px-4 py-2.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pp?.[jenis] || []).length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Tidak ada data</td></tr>
                      ) : pp[jenis].map((n) => (
                        <tr key={n.id} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{n.nomor_nota}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{formatTanggal(n.tanggal_nota)}</td>
                          <td className="px-4 py-2.5 text-xs">{n.kode_rekening_nama}</td>
                          <td className="px-4 py-2.5 capitalize">{n.sumber_dana}</td>
                          <td className="px-4 py-2.5">{n.kegiatan}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatRupiah(n.total_nota)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/80 font-bold">
                        <td colSpan={5} className="px-4 py-2.5 text-right">Subtotal</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatRupiah(jenis === "pendapatan" ? pp?.total_pendapatan : pp?.total_pengeluaran)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="item-sumber-dana" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={exportItemExcel} data-testid="btn-export-item-excel" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
              <Button onClick={exportItemPdf} data-testid="btn-export-item-pdf" className="bg-rose-600 hover:bg-rose-700 text-white gap-2"><FileText className="h-4 w-4" /> Export PDF</Button>
            </div>
            {(itemSumber?.groups || []).length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground text-sm">Tidak ada data item.</Card>
            ) : itemSumber.groups.map((g) => (
              <Card key={g.sumber_dana} className="overflow-hidden" data-testid={`group-${g.sumber_dana}`}>
                <div className="px-4 py-3 flex items-center justify-between bg-muted/60">
                  <span className="font-heading font-semibold text-sm capitalize">{sumberDanaLabel[g.sumber_dana] || g.sumber_dana}</span>
                  <Badge variant="outline" className="font-mono tabular-nums">{formatRupiah(g.total)}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground border-b border-border">
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">No Nota</th>
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">Item</th>
                        <th className="text-left font-semibold text-xs uppercase px-4 py-2.5">Jenis</th>
                        <th className="text-right font-semibold text-xs uppercase px-4 py-2.5">Unit</th>
                        <th className="text-right font-semibold text-xs uppercase px-4 py-2.5">Harga</th>
                        <th className="text-right font-semibold text-xs uppercase px-4 py-2.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((it, i) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-2.5">{it.nomor_nota}</td>
                          <td className="px-4 py-2.5 font-medium">{it.nama}</td>
                          <td className="px-4 py-2.5 capitalize text-xs">{it.jenis}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">{it.unit}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatRupiah(it.harga_per_unit)}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatRupiah(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

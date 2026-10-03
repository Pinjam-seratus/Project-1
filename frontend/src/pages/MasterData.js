import React, { useEffect, useRef, useState } from "react";
import api, { API, formatApiError } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Upload, Pencil, Trash2, Loader2, Database, Download } from "lucide-react";
import { toast } from "sonner";

const KINDS = {
  "kode-rekening": {
    label: "Kode Rekening",
    columns: [
      { key: "kode", label: "Kode" },
      { key: "nama", label: "Nama" },
      { key: "jenis", label: "Jenis" },
    ],
    empty: { kode: "", nama: "", jenis: "pengeluaran" },
    template: "kode,nama,jenis\n4.1.01,Iuran Siswa,pendapatan\n5.1.01,Belanja ATK,pengeluaran",
  },
  kegiatan: {
    label: "Kegiatan",
    columns: [
      { key: "nama", label: "Nama" },
      { key: "keterangan", label: "Keterangan" },
    ],
    empty: { nama: "", keterangan: "" },
    template: "nama,keterangan\nOperasional,Kegiatan harian\nPengembangan,Program pengembangan",
  },
  "item-barang": {
    label: "Item Barang",
    columns: [
      { key: "nama", label: "Nama" },
      { key: "satuan", label: "Satuan" },
      { key: "harga_default", label: "Harga Default", money: true },
    ],
    empty: { nama: "", satuan: "pcs", harga_default: 0 },
    template: "nama,satuan,harga_default\nKertas A4,rim,55000\nPulpen,pcs,3000",
  },
};

function MasterTable({ kind }) {
  const cfg = KINDS[kind];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // {mode, data}
  const [form, setForm] = useState(cfg.empty);
  const [deleteId, setDeleteId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/master/${kind}`);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kind]);

  const openAdd = () => { setForm(cfg.empty); setDialog({ mode: "add" }); };
  const openEdit = (row) => {
    const f = {};
    cfg.columns.forEach((c) => (f[c.key] = row[c.key] ?? cfg.empty[c.key]));
    setForm(f);
    setDialog({ mode: "edit", id: row.id });
  };

  const save = async () => {
    for (const c of cfg.columns) {
      if (c.key !== "keterangan" && c.key !== "satuan" && !String(form[c.key] ?? "").trim() && !c.money)
        return toast.error(`${c.label} wajib diisi`);
    }
    try {
      const payload = { ...form };
      if ("harga_default" in payload) payload.harga_default = Number(payload.harga_default) || 0;
      if (dialog.mode === "add") await api.post(`/master/${kind}`, payload);
      else await api.put(`/master/${kind}/${dialog.id}`, payload);
      toast.success("Data disimpan");
      setDialog(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err, "Gagal menyimpan"));
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/master/${kind}/${deleteId}`);
      toast.success("Data dihapus");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/master/${kind}/import`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(data.message);
      if (data.errors?.length) toast.warning(`${data.errors.length} baris gagal`);
      load();
    } catch (err) {
      toast.error(formatApiError(err, "Gagal import"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([cfg.template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{rows.length} data</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} data-testid={`input-import-${kind}`} />
          <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid={`btn-template-${kind}`} className="gap-2">
            <Download className="h-4 w-4" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing} data-testid={`btn-import-${kind}`} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import Excel
          </Button>
          <Button size="sm" onClick={openAdd} data-testid={`btn-tambah-${kind}`} className="gap-2">
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Belum ada data. Tambah manual atau import dari Excel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                  {cfg.columns.map((c) => (
                    <th key={c.key} className={`font-semibold text-xs uppercase px-4 py-3 ${c.money ? "text-right" : "text-left"}`}>{c.label}</th>
                  ))}
                  <th className="text-center font-semibold text-xs uppercase px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`master-row-${row.id}`}>
                    {cfg.columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 ${c.money ? "text-right font-mono tabular-nums" : ""}`}>
                        {c.key === "jenis" ? (
                          <Badge variant="outline" className={`capitalize ${row.jenis === "pendapatan" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"}`}>{row.jenis}</Badge>
                        ) : c.money ? formatRupiah(row[c.key]) : (row[c.key] || "-")}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)} data-testid={`btn-edit-master-${row.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(row.id)} data-testid={`btn-hapus-master-${row.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{dialog?.mode === "add" ? "Tambah" : "Edit"} {cfg.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {cfg.columns.map((c) => (
              <div key={c.key} className="space-y-2">
                <Label>{c.label}</Label>
                {c.key === "jenis" ? (
                  <Select value={form.jenis} onValueChange={(v) => setForm((f) => ({ ...f, jenis: v }))}>
                    <SelectTrigger data-testid="select-jenis-rekening"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendapatan">Pendapatan</SelectItem>
                      <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input type={c.money ? "number" : "text"} value={form[c.key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                    data-testid={`input-master-${c.key}`} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={save} data-testid="btn-simpan-master">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MasterData() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">Master Data</h2>
        <p className="text-sm text-muted-foreground mt-1">Kelola kode rekening, kegiatan, dan item barang</p>
      </div>
      <Tabs defaultValue="kode-rekening">
        <TabsList data-testid="tabs-master">
          <TabsTrigger value="kode-rekening" data-testid="tab-kode-rekening">Kode Rekening</TabsTrigger>
          <TabsTrigger value="kegiatan" data-testid="tab-kegiatan">Kegiatan</TabsTrigger>
          <TabsTrigger value="item-barang" data-testid="tab-item-barang">Item Barang</TabsTrigger>
        </TabsList>
        <TabsContent value="kode-rekening" className="mt-4"><MasterTable kind="kode-rekening" /></TabsContent>
        <TabsContent value="kegiatan" className="mt-4"><MasterTable kind="kegiatan" /></TabsContent>
        <TabsContent value="item-barang" className="mt-4"><MasterTable kind="item-barang" /></TabsContent>
      </Tabs>
    </div>
  );
}

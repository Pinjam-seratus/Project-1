import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FilePlus2, Pencil, Trash2, Eye, Loader2, Search, Receipt } from "lucide-react";
import { toast } from "sonner";

const sumberDanaColor = {
  kasir: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300",
  transfer: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300",
  koperasi: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300",
  pengembangan: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export default function DaftarNota() {
  const navigate = useNavigate();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/nota");
      setNotas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const confirmDelete = async () => {
    try {
      await api.delete(`/nota/${deleteId}`);
      toast.success("Nota dihapus");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Gagal menghapus nota");
    }
  };

  const filtered = notas.filter((n) =>
    n.nomor_nota?.toLowerCase().includes(search.toLowerCase()) ||
    n.kode_rekening_nama?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">Daftar Nota</h2>
          <p className="text-sm text-muted-foreground mt-1">{notas.length} nota tersimpan</p>
        </div>
        <Button onClick={() => navigate("/input-nota")} data-testid="btn-tambah-nota" className="gap-2">
          <FilePlus2 className="h-4 w-4" /> Buat Nota
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-nota" placeholder="Cari nomor nota / rekening..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="font-medium">Belum ada nota</p>
          <p className="text-sm mt-1">Mulai dengan membuat nota baru.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Nomor Nota</th>
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Tanggal</th>
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Kode Rekening</th>
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Sumber Dana</th>
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Kegiatan</th>
                  <th className="text-right font-semibold text-xs uppercase px-4 py-3">Total</th>
                  <th className="text-center font-semibold text-xs uppercase px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`nota-row-${n.id}`}>
                    <td className="px-4 py-3 font-medium">{n.nomor_nota}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatTanggal(n.tanggal_nota)}</td>
                    <td className="px-4 py-3 text-xs">{n.kode_rekening_nama || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`capitalize text-xs ${sumberDanaColor[n.sumber_dana] || ""}`}>{n.sumber_dana}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{n.kegiatan}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${n.jenis === "pendapatan" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {n.jenis === "pendapatan" ? "+" : "-"}{formatRupiah(n.total_nota)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(n)} data-testid={`btn-lihat-${n.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/input-nota/${n.id}`)} data-testid={`btn-edit-${n.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(n.id)} data-testid={`btn-hapus-${n.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Nota?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-batal-hapus">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="btn-konfirmasi-hapus" className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Detail Nota — {detail?.nomor_nota}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Tanggal Nota:</span> {formatTanggal(detail.tanggal_nota)}</div>
                <div><span className="text-muted-foreground">Tanggal Bayar:</span> {formatTanggal(detail.tanggal_bayar)}</div>
                <div><span className="text-muted-foreground">Kode Rekening:</span> {detail.kode_rekening_nama}</div>
                <div><span className="text-muted-foreground">Sumber Dana:</span> <span className="capitalize">{detail.sumber_dana}</span></div>
                <div><span className="text-muted-foreground">Kegiatan:</span> {detail.kegiatan}</div>
                <div><span className="text-muted-foreground">Jenis:</span> <span className="capitalize">{detail.jenis}</span></div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-xs uppercase">
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Unit</th>
                      <th className="text-right px-3 py-2">Harga</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items?.map((it, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">{it.nama}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{it.unit}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatRupiah(it.harga_per_unit)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatRupiah(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/80 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right">Total Nota</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatRupiah(detail.total_nota)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {detail.keterangan && <p className="text-sm text-muted-foreground">Keterangan: {detail.keterangan}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { formatRupiah, todayISO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

const SUMBER_DANA = ["kasir", "transfer", "koperasi", "pengembangan"];

const emptyItem = () => ({ item_barang_id: "", nama: "", unit: 1, harga_per_unit: 0 });

export default function InputNota() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [kodeRekening, setKodeRekening] = useState([]);
  const [kegiatan, setKegiatan] = useState([]);
  const [itemBarang, setItemBarang] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nomor_nota: "",
    tanggal_nota: todayISO(),
    tanggal_bayar: "",
    kode_rekening: "",
    sumber_dana: "",
    kegiatan: "",
    keterangan: "",
  });
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    (async () => {
      const [kr, kg, ib] = await Promise.all([
        api.get("/master/kode-rekening"),
        api.get("/master/kegiatan"),
        api.get("/master/item-barang"),
      ]);
      setKodeRekening(kr.data);
      setKegiatan(kg.data);
      setItemBarang(ib.data);
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get(`/nota/${id}`);
        setForm({
          nomor_nota: data.nomor_nota, tanggal_nota: data.tanggal_nota,
          tanggal_bayar: data.tanggal_bayar || "", kode_rekening: data.kode_rekening,
          sumber_dana: data.sumber_dana, kegiatan: data.kegiatan, keterangan: data.keterangan || "",
        });
        setItems(data.items.map((it) => ({
          item_barang_id: it.item_barang_id || "", nama: it.nama,
          unit: it.unit, harga_per_unit: it.harga_per_unit,
        })));
      } catch {
        toast.error("Nota tidak ditemukan");
      }
    })();
  }, [id]);

  const selectedKode = kodeRekening.find((k) => k.id === form.kode_rekening);

  const totalNota = useMemo(
    () => items.reduce((s, it) => s + (Number(it.unit) || 0) * (Number(it.harga_per_unit) || 0), 0),
    [items]
  );

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const updateItem = (idx, patch) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const onPickItem = (idx, itemId) => {
    const found = itemBarang.find((i) => i.id === itemId);
    if (found) {
      updateItem(idx, {
        item_barang_id: found.id, nama: found.nama,
        harga_per_unit: found.harga_default || 0,
      });
    }
  };

  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (idx) => setItems((arr) => (arr.length === 1 ? arr : arr.filter((_, i) => i !== idx)));

  const handleSubmit = async () => {
    if (!form.nomor_nota.trim()) return toast.error("Nomor nota wajib diisi");
    if (!form.kode_rekening) return toast.error("Pilih kode rekening");
    if (!form.sumber_dana) return toast.error("Pilih sumber dana");
    if (!form.kegiatan) return toast.error("Pilih kegiatan");
    const validItems = items.filter((it) => it.nama.trim());
    if (validItems.length === 0) return toast.error("Tambahkan minimal satu item barang");

    setSaving(true);
    try {
      const payload = {
        ...form,
        kode_rekening_nama: selectedKode ? `${selectedKode.kode} - ${selectedKode.nama}` : "",
        jenis: selectedKode?.jenis || "pengeluaran",
        items: validItems.map((it) => ({
          item_barang_id: it.item_barang_id || null,
          nama: it.nama,
          unit: Number(it.unit) || 0,
          harga_per_unit: Number(it.harga_per_unit) || 0,
          total: (Number(it.unit) || 0) * (Number(it.harga_per_unit) || 0),
        })),
        total_nota: totalNota,
      };
      if (id) await api.delete(`/nota/${id}`);
      await api.post("/nota", payload);
      toast.success(id ? "Nota berhasil diperbarui" : "Nota berhasil disimpan");
      navigate("/daftar-nota");
    } catch (err) {
      toast.error(formatApiError(err, "Gagal menyimpan nota"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
          <Receipt className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">{id ? "Edit Nota" : "Input Nota Baru"}</h2>
          <p className="text-sm text-muted-foreground">Lengkapi data nota lalu klik Selesai & Simpan</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Nomor Nota</Label>
            <Input data-testid="input-nomor-nota" value={form.nomor_nota}
              onChange={(e) => setField("nomor_nota", e.target.value)} placeholder="cth: NT-2026-001" />
          </div>
          <div className="space-y-2">
            <Label>Tanggal Nota</Label>
            <Input type="date" data-testid="input-tanggal-nota" value={form.tanggal_nota}
              onChange={(e) => setField("tanggal_nota", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tanggal Bayar</Label>
            <Input type="date" data-testid="input-tanggal-bayar" value={form.tanggal_bayar}
              onChange={(e) => setField("tanggal_bayar", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Kode Rekening</Label>
            <Select value={form.kode_rekening} onValueChange={(v) => setField("kode_rekening", v)}>
              <SelectTrigger data-testid="select-kode-rekening"><SelectValue placeholder="Pilih kode rekening" /></SelectTrigger>
              <SelectContent>
                {kodeRekening.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Belum ada data</div>}
                {kodeRekening.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.kode} - {k.nama} <span className="text-xs text-muted-foreground">({k.jenis})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sumber Dana</Label>
            <Select value={form.sumber_dana} onValueChange={(v) => setField("sumber_dana", v)}>
              <SelectTrigger data-testid="select-sumber-dana"><SelectValue placeholder="Pilih sumber dana" /></SelectTrigger>
              <SelectContent>
                {SUMBER_DANA.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kegiatan</Label>
            <Select value={form.kegiatan} onValueChange={(v) => setField("kegiatan", v)}>
              <SelectTrigger data-testid="select-kegiatan"><SelectValue placeholder="Pilih kegiatan" /></SelectTrigger>
              <SelectContent>
                {kegiatan.map((k) => <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedKode && (
          <p className="text-xs text-muted-foreground">
            Jenis transaksi:{" "}
            <span className={selectedKode.jenis === "pendapatan" ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
              {selectedKode.jenis === "pendapatan" ? "Pendapatan" : "Pengeluaran"}
            </span>
          </p>
        )}

        {/* Items table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="text-left font-semibold text-xs uppercase px-3 py-3 w-[36%]">Item Barang</th>
                <th className="text-right font-semibold text-xs uppercase px-3 py-3 w-[14%]">Unit</th>
                <th className="text-right font-semibold text-xs uppercase px-3 py-3 w-[22%]">Harga / Unit</th>
                <th className="text-right font-semibold text-xs uppercase px-3 py-3 w-[22%]">Total</th>
                <th className="px-2 py-3 w-[6%]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const rowTotal = (Number(it.unit) || 0) * (Number(it.harga_per_unit) || 0);
                return (
                  <tr key={idx} className="border-t border-border hover:bg-muted/30 transition-colors" data-testid={`item-row-${idx}`}>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1.5">
                        <Select value={it.item_barang_id || undefined} onValueChange={(v) => onPickItem(idx, v)}>
                          <SelectTrigger data-testid={`select-item-${idx}`} className="h-9">
                            <SelectValue placeholder="Pilih dari database" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemBarang.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Belum ada item</div>}
                            {itemBarang.map((i) => <SelectItem key={i.id} value={i.id}>{i.nama}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input data-testid={`input-item-nama-${idx}`} value={it.nama}
                          onChange={(e) => updateItem(idx, { nama: e.target.value, item_barang_id: "" })}
                          placeholder="atau ketik nama item" className="h-8 text-xs" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" data-testid={`input-unit-${idx}`} value={it.unit}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        className="h-9 text-right font-mono tabular-nums" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" data-testid={`input-harga-${idx}`} value={it.harga_per_unit}
                        onChange={(e) => updateItem(idx, { harga_per_unit: e.target.value })}
                        className="h-9 text-right font-mono tabular-nums" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium tabular-nums" data-testid={`item-total-${idx}`}>
                      {formatRupiah(rowTotal)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(idx)} data-testid={`btn-hapus-item-${idx}`} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/80 border-t border-border">
                <td colSpan={3} className="px-3 py-3 font-semibold text-right">Total Nota</td>
                <td className="px-3 py-3 text-right font-mono font-bold text-base tabular-nums" data-testid="total-nota">
                  {formatRupiah(totalNota)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <Button variant="outline" onClick={addItem} data-testid="btn-tambah-item"
          className="w-full sm:w-auto border-dashed border-2 border-primary/30 hover:border-primary hover:bg-primary/5 text-primary gap-2">
          <Plus className="h-4 w-4" /> Tambah Item
        </Button>

        <div className="space-y-2">
          <Label>Keterangan (opsional)</Label>
          <Input data-testid="input-keterangan" value={form.keterangan}
            onChange={(e) => setField("keterangan", e.target.value)} placeholder="Catatan tambahan" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => navigate("/daftar-nota")} data-testid="btn-batal">Batal</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="btn-simpan-nota"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Selesai & Simpan
          </Button>
        </div>
      </Card>
    </div>
  );
}

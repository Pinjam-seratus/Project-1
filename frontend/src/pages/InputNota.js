import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { formatRupiah, todayISO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

const emptyItem = () => ({ item_barang_id: "", nama: "", kode_rekening: "", kode_rekening_nama: "", kategori: "", unit: 1, harga_per_unit: 0 });

const jenisFromKode = (kode) => (String(kode || "").trim().startsWith("1") ? "pendapatan" : "belanja");

export default function InputNota() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [kodeRekening, setKodeRekening] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [itemBarang, setItemBarang] = useState([]);
  const [sumberDana, setSumberDana] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nomor_nota: "", tanggal_nota: todayISO(), tanggal_bayar: "", sumber_dana: "", keterangan: "",
  });
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    (async () => {
      const [kr, kg, ib, sd] = await Promise.all([
        api.get("/master/kode-rekening"),
        api.get("/master/kegiatan"),
        api.get("/master/item-barang"),
        api.get("/master/sumber-dana"),
      ]);
      setKodeRekening(kr.data);
      setKategori(kg.data);
      setItemBarang(ib.data);
      setSumberDana(sd.data);
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get(`/nota/${id}`);
        setForm({
          nomor_nota: data.nomor_nota, tanggal_nota: data.tanggal_nota,
          tanggal_bayar: data.tanggal_bayar || "", sumber_dana: data.sumber_dana, keterangan: data.keterangan || "",
        });
        setItems(data.items.map((it) => ({
          item_barang_id: it.item_barang_id || "", nama: it.nama,
          kode_rekening: it.kode_rekening || "", kode_rekening_nama: it.kode_rekening_nama || "",
          kategori: it.kategori || "", unit: it.unit, harga_per_unit: it.harga_per_unit,
        })));
      } catch {
        toast.error("Nota tidak ditemukan");
      }
    })();
  }, [id]);

  const totalNota = useMemo(
    () => items.reduce((s, it) => s + (Number(it.unit) || 0) * (Number(it.harga_per_unit) || 0), 0),
    [items]
  );

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateItem = (idx, patch) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const onPickItem = (idx, itemId) => {
    const found = itemBarang.find((i) => i.id === itemId);
    if (found) {
      updateItem(idx, {
        item_barang_id: found.id, nama: found.nama,
        kode_rekening: found.kode_rek || "", kode_rekening_nama: found.kode_rek_nama || "",
        kategori: found.kategori || "",
      });
    }
  };

  const onPickKode = (idx, kode) => {
    const found = kodeRekening.find((k) => k.kode === kode);
    updateItem(idx, { kode_rekening: kode, kode_rekening_nama: found ? found.nama : "" });
  };

  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (idx) => setItems((arr) => (arr.length === 1 ? arr : arr.filter((_, i) => i !== idx)));

  const handleSubmit = async () => {
    if (!form.nomor_nota.trim()) return toast.error("Nomor nota wajib diisi");
    if (!form.sumber_dana) return toast.error("Pilih sumber dana");
    const validItems = items.filter((it) => it.nama.trim());
    if (validItems.length === 0) return toast.error("Tambahkan minimal satu item barang");

    setSaving(true);
    try {
      const payload = {
        ...form,
        items: validItems.map((it) => ({
          item_barang_id: it.item_barang_id || null,
          nama: it.nama,
          kode_rekening: it.kode_rekening || "",
          kode_rekening_nama: it.kode_rekening_nama || "",
          kategori: it.kategori || "",
          jenis: jenisFromKode(it.kode_rekening),
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
          <p className="text-sm text-muted-foreground">Satu nota bisa berisi banyak item dengan kode rekening & kategori berbeda</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Nomor Nota</Label>
            <Input data-testid="input-nomor-nota" value={form.nomor_nota} onChange={(e) => setField("nomor_nota", e.target.value)} placeholder="cth: NT-001" />
          </div>
          <div className="space-y-2">
            <Label>Tanggal Nota</Label>
            <Input type="date" data-testid="input-tanggal-nota" value={form.tanggal_nota} onChange={(e) => setField("tanggal_nota", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tanggal Bayar</Label>
            <Input type="date" data-testid="input-tanggal-bayar" value={form.tanggal_bayar} onChange={(e) => setField("tanggal_bayar", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Sumber Dana</Label>
            <Select value={form.sumber_dana || undefined} onValueChange={(v) => setField("sumber_dana", v)}>
              <SelectTrigger data-testid="select-sumber-dana"><SelectValue placeholder="Pilih sumber dana" /></SelectTrigger>
              <SelectContent>
                {sumberDana.map((s) => <SelectItem key={s.id} value={s.kode}>{s.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Daftar Item Barang</Label>
            <span className="text-xs text-muted-foreground">{items.length} item</span>
          </div>

          {items.map((it, idx) => {
            const rowTotal = (Number(it.unit) || 0) * (Number(it.harga_per_unit) || 0);
            const jenis = jenisFromKode(it.kode_rekening);
            return (
              <Card key={idx} className="p-4 bg-muted/20 border-dashed" data-testid={`item-row-${idx}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground">Item #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    {it.kode_rekening && (
                      <Badge variant="outline" className={`text-[10px] capitalize ${jenis === "pendapatan" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"}`}>{jenis}</Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)} data-testid={`btn-hapus-item-${idx}`} disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Item Barang</Label>
                    <Select value={it.item_barang_id || undefined} onValueChange={(v) => onPickItem(idx, v)}>
                      <SelectTrigger data-testid={`select-item-${idx}`} className="h-9"><SelectValue placeholder="Pilih dari database" /></SelectTrigger>
                      <SelectContent>
                        {itemBarang.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Belum ada item</div>}
                        {itemBarang.map((i) => <SelectItem key={i.id} value={i.id}>{i.nama}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input data-testid={`input-item-nama-${idx}`} value={it.nama} onChange={(e) => updateItem(idx, { nama: e.target.value, item_barang_id: "" })} placeholder="atau ketik nama" className="h-8 text-xs" />
                  </div>
                  <div className="lg:col-span-3 space-y-1.5">
                    <Label className="text-xs">Kode Rekening</Label>
                    <Select value={it.kode_rekening || undefined} onValueChange={(v) => onPickKode(idx, v)}>
                      <SelectTrigger data-testid={`select-kode-${idx}`} className="h-9"><SelectValue placeholder="Kode rekening" /></SelectTrigger>
                      <SelectContent>
                        {kodeRekening.map((k) => <SelectItem key={k.id} value={k.kode}>{k.kode} — {k.nama}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-2 space-y-1.5">
                    <Label className="text-xs">Kategori</Label>
                    <Select value={it.kategori || undefined} onValueChange={(v) => updateItem(idx, { kategori: v })}>
                      <SelectTrigger data-testid={`select-kategori-${idx}`} className="h-9"><SelectValue placeholder="Kategori" /></SelectTrigger>
                      <SelectContent>
                        {kategori.map((k) => <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-1 space-y-1.5">
                    <Label className="text-xs">Unit</Label>
                    <Input type="number" min="0" data-testid={`input-unit-${idx}`} value={it.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })} className="h-9 text-right font-mono" />
                  </div>
                  <div className="lg:col-span-2 space-y-1.5">
                    <Label className="text-xs">Harga / Unit</Label>
                    <Input type="number" min="0" data-testid={`input-harga-${idx}`} value={it.harga_per_unit} onChange={(e) => updateItem(idx, { harga_per_unit: e.target.value })} className="h-9 text-right font-mono" />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <span className="text-sm">Total item: <span className="font-mono font-semibold tabular-nums" data-testid={`item-total-${idx}`}>{formatRupiah(rowTotal)}</span></span>
                </div>
              </Card>
            );
          })}

          <Button variant="outline" onClick={addItem} data-testid="btn-tambah-item" className="w-full sm:w-auto border-dashed border-2 border-primary/30 hover:border-primary hover:bg-primary/5 text-primary gap-2">
            <Plus className="h-4 w-4" /> Tambah Item
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-primary text-primary-foreground px-5 py-4">
          <span className="font-heading font-semibold">Total Nota</span>
          <span className="font-mono font-bold text-xl tabular-nums" data-testid="total-nota">{formatRupiah(totalNota)}</span>
        </div>

        <div className="space-y-2">
          <Label>Keterangan (opsional)</Label>
          <Input data-testid="input-keterangan" value={form.keterangan} onChange={(e) => setField("keterangan", e.target.value)} placeholder="Catatan tambahan" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => navigate("/daftar-nota")} data-testid="btn-batal">Batal</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="btn-simpan-nota" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Selesai & Simpan
          </Button>
        </div>
      </Card>
    </div>
  );
}

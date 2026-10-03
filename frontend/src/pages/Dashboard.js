import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatRupiah, formatTanggal, todayISO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FilePlus2, Loader2, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

const StatCard = ({ title, value, icon: Icon, accent, testid }) => (
  <Card className="p-5 relative overflow-hidden" data-testid={testid}>
    <div className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="font-mono font-bold text-xl sm:text-2xl mt-2 tabular-nums">{value}</p>
      </div>
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [notas, setNotas] = useState([]);
  const [sumberDana, setSumberDana] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, n, sd] = await Promise.all([
          api.get("/reports/summary"),
          api.get("/nota"),
          api.get("/master/sumber-dana"),
        ]);
        setSummary(s.data);
        setNotas(n.data);
        setSumberDana(sd.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sdName = (kode) => sumberDana.find((x) => x.kode === kode)?.nama || kode;

  if (loading)
    return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div>;

  const recent = notas.slice(0, 6);
  const chartData = [
    { name: "Pendapatan", value: summary?.total_pendapatan || 0, color: "#10B981" },
    { name: "Pengeluaran", value: summary?.total_pengeluaran || 0, color: "#F43F5E" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Ringkasan Keuangan</h2>
          <p className="text-sm text-muted-foreground mt-1">Per {formatTanggal(todayISO())}</p>
        </div>
        <Button onClick={() => navigate("/input-nota")} data-testid="btn-new-nota" className="gap-2">
          <FilePlus2 className="h-4 w-4" /> Buat Nota Baru
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Pendapatan" value={formatRupiah(summary?.total_pendapatan)}
          icon={TrendingUp} accent="bg-emerald-500" testid="stat-total-pendapatan" />
        <StatCard title="Total Pengeluaran" value={formatRupiah(summary?.total_pengeluaran)}
          icon={TrendingDown} accent="bg-rose-500" testid="stat-total-pengeluaran" />
        <StatCard title="Saldo" value={formatRupiah(summary?.saldo)}
          icon={Wallet} accent="bg-sky-500" testid="stat-saldo-net" />
        <StatCard title="Jumlah Nota" value={summary?.jumlah_nota || 0}
          icon={Receipt} accent="bg-slate-400" testid="stat-jumlah-nota" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-heading font-semibold text-base mb-4">Pendapatan vs Pengeluaran</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}jt` : v >= 1000 ? `${v / 1000}rb` : v)}
                tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-base">Nota Terbaru</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/daftar-nota")} className="gap-1 text-accent" data-testid="btn-lihat-semua-nota">
              Lihat semua <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Belum ada nota. Mulai dengan membuat nota baru.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((n) => (
                <div key={n.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`recent-nota-${n.id}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{n.nomor_nota}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatTanggal(n.tanggal_nota)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{sdName(n.sumber_dana)}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-sm tabular-nums">
                      {formatRupiah(n.total_nota)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

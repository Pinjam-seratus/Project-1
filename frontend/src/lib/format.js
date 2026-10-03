export const formatRupiah = (value) => {
  const num = Number(value || 0);
  return "Rp " + num.toLocaleString("id-ID", { maximumFractionDigits: 0 });
};

export const formatNumber = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("id-ID", { maximumFractionDigits: 2 });
};

export const formatTanggal = (iso) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

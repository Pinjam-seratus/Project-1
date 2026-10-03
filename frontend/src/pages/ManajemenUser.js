import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { UserPlus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function ManajemenUser() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // {mode, id}
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "user" });
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ username: "", name: "", password: "", role: "user" }); setDialog({ mode: "add" }); };
  const openEdit = (u) => { setForm({ username: u.username, name: u.name, password: "", role: u.role }); setDialog({ mode: "edit", id: u.id }); };

  const save = async () => {
    if (dialog.mode === "add") {
      if (!form.username.trim() || !form.password || !form.name.trim())
        return toast.error("Username, nama, dan password wajib diisi");
    }
    try {
      if (dialog.mode === "add") {
        await api.post("/users", form);
      } else {
        const payload = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${dialog.id}`, payload);
      }
      toast.success("User disimpan");
      setDialog(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err, "Gagal menyimpan user"));
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/users/${deleteId}`);
      toast.success("User dihapus");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err, "Gagal menghapus"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">Manajemen User</h2>
          <p className="text-sm text-muted-foreground mt-1">Kelola akun pengguna aplikasi</p>
        </div>
        <Button onClick={openAdd} data-testid="btn-tambah-user" className="gap-2">
          <UserPlus className="h-4 w-4" /> Tambah User
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="text-sm">Belum ada user.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Username</th>
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Nama</th>
                  <th className="text-left font-semibold text-xs uppercase px-4 py-3">Role</th>
                  <th className="text-center font-semibold text-xs uppercase px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`user-row-${u.id}`}>
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`capitalize ${u.role === "admin" ? "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300" : ""}`}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} data-testid={`btn-edit-user-${u.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(u.id)} disabled={u.id === me?.id} data-testid={`btn-hapus-user-${u.id}`}>
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
            <DialogTitle className="font-heading">{dialog?.mode === "add" ? "Tambah User" : "Edit User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} disabled={dialog?.mode === "edit"}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} data-testid="input-user-username" />
            </div>
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} data-testid="input-user-name" />
            </div>
            <div className="space-y-2">
              <Label>Password {dialog?.mode === "edit" && <span className="text-xs text-muted-foreground">(kosongkan jika tidak diubah)</span>}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} data-testid="input-user-password" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={save} data-testid="btn-simpan-user">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus user?</AlertDialogTitle>
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

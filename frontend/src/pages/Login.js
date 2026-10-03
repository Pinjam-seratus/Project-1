import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      toast.success("Login berhasil");
    } catch (err) {
      const msg = formatApiError(err, "Gagal login");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center">
            <Wallet className="h-6 w-6 text-accent-foreground" />
          </div>
          <span className="font-heading font-extrabold text-2xl tracking-tight">FinNota</span>
        </div>
        <div className="relative">
          <h2 className="font-heading text-4xl font-extrabold leading-tight tracking-tight">
            Kelola nota pendapatan & pengeluaran dengan rapi.
          </h2>
          <p className="mt-4 text-primary-foreground/70 text-base max-w-md">
            Input nota, kelola master data, dan hasilkan laporan keuangan lengkap dengan ekspor Excel & PDF.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50 relative">© {new Date().getFullYear()} FinNota</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-extrabold text-xl">FinNota</span>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Masuk ke akun Anda</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-8">Gunakan username dan password Anda</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" data-testid="input-username" value={username}
                onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" data-testid="input-password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="btn-login">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

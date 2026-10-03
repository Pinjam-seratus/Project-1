import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, FilePlus2, ListChecks, Database, BarChart3, Users,
  Moon, Sun, LogOut, Menu, X, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-link-dashboard" },
  { to: "/input-nota", label: "Input Nota", icon: FilePlus2, testid: "sidebar-link-input-nota" },
  { to: "/daftar-nota", label: "Daftar Nota", icon: ListChecks, testid: "sidebar-link-daftar-nota" },
  { to: "/master-data", label: "Master Data", icon: Database, testid: "sidebar-link-master-data" },
  { to: "/laporan", label: "Laporan", icon: BarChart3, testid: "sidebar-link-laporan" },
  { to: "/manajemen-user", label: "Manajemen User", icon: Users, testid: "sidebar-link-manajemen-user", adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const nav = NAV.filter((n) => !n.adminOnly || user?.role === "admin");

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="font-heading font-extrabold text-lg leading-none tracking-tight">FinNota</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Input Nota & Laporan</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = location.pathname === item.to ||
            (item.to !== "/" && location.pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <div className="px-3 pb-3">
          <p className="text-sm font-semibold truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
        </div>
        <Button variant="ghost" onClick={handleLogout} data-testid="btn-logout"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive">
          <LogOut className="h-[18px] w-[18px]" /> Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 border-r border-border bg-card fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-card border-r border-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 min-w-0">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} data-testid="btn-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-heading font-bold text-base sm:text-lg tracking-tight">
              {nav.find((n) => n.to === location.pathname)?.label ||
                (location.pathname.startsWith("/input-nota") ? "Input Nota" : "FinNota")}
            </h1>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="btn-toggle-theme">
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>
        </header>
        <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

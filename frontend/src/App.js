import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import InputNota from "@/pages/InputNota";
import DaftarNota from "@/pages/DaftarNota";
import MasterData from "@/pages/MasterData";
import Laporan from "@/pages/Laporan";
import ManajemenUser from "@/pages/ManajemenUser";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children, adminOnly }) => {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/input-nota" element={<ProtectedRoute><InputNota /></ProtectedRoute>} />
      <Route path="/input-nota/:id" element={<ProtectedRoute><InputNota /></ProtectedRoute>} />
      <Route path="/daftar-nota" element={<ProtectedRoute><DaftarNota /></ProtectedRoute>} />
      <Route path="/master-data" element={<ProtectedRoute><MasterData /></ProtectedRoute>} />
      <Route path="/laporan" element={<ProtectedRoute><Laporan /></ProtectedRoute>} />
      <Route path="/manajemen-user" element={<ProtectedRoute adminOnly><ManajemenUser /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;

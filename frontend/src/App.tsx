import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./lib/auth";
import { apiClient } from "./lib/client";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Browse } from "./pages/Browse";
import { ListingDetail } from "./pages/ListingDetail";
import { CreateListing } from "./pages/CreateListing";
import { Orders } from "./pages/Orders";
import { OrderDetail } from "./pages/OrderDetail";
import { Rentals } from "./pages/Rentals";
import { RentalDetail } from "./pages/RentalDetail";
import { Wallet } from "./pages/Wallet";
import { Profile } from "./pages/Profile";
import { Dashboard } from "./pages/Dashboard";
import { Admin } from "./pages/Admin";
import { PageTransition } from "./components/PageTransition";

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (!user?.is_admin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, setUser, clear } = useAuth();

  useEffect(() => {
    if (!token) return;
    apiClient.me().then((r) => setUser(r.data)).catch(() => clear());
  }, [token]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Protected><PageTransition><Dashboard /></PageTransition></Protected>} />
        <Route path="/browse" element={<PageTransition><Browse /></PageTransition>} />
        <Route path="/listing/:id" element={<PageTransition><ListingDetail /></PageTransition>} />
        <Route path="/orders" element={<Protected><PageTransition><Orders /></PageTransition></Protected>} />
        <Route path="/orders/:id" element={<Protected><PageTransition><OrderDetail /></PageTransition></Protected>} />
        <Route path="/rentals" element={<Protected><PageTransition><Rentals /></PageTransition></Protected>} />
        <Route path="/rentals/:id" element={<Protected><PageTransition><RentalDetail /></PageTransition></Protected>} />
        <Route path="/create" element={<Protected><PageTransition><CreateListing /></PageTransition></Protected>} />
        <Route path="/wallet" element={<Protected><PageTransition><Wallet /></PageTransition></Protected>} />
        <Route path="/profile" element={<Protected><PageTransition><Profile /></PageTransition></Protected>} />
        <Route path="/profile/:userId" element={<PageTransition><Profile /></PageTransition>} />
        <Route path="/admin" element={<AdminProtected><PageTransition><Admin /></PageTransition></AdminProtected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
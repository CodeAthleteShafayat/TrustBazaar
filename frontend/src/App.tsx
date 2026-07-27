import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./lib/auth";
import { apiClient } from "./lib/client";
import { ApiError } from "./lib/api";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Browse } from "./pages/Browse";
import { ListingDetail } from "./pages/ListingDetail";
import { CreateListing } from "./pages/CreateListing";
import { Checkout } from "./pages/Checkout";
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
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const loc = useLocation();
  // Wait for the persisted session to load from localStorage before deciding to redirect —
  // otherwise every hard refresh of a protected page briefly reads token as null and bounces
  // a logged-in user to /login. See the note on hasHydrated in lib/auth.ts.
  if (!hasHydrated) return null;
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const loc = useLocation();
  if (!hasHydrated) return null;
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (!user?.is_admin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, hasHydrated, setUser, clear } = useAuth();

  useEffect(() => {
    if (!hasHydrated || !token) return;
    apiClient.me().then((r) => setUser(r.data)).catch((e) => {
      // Only a genuine "this token is invalid/expired" response should log the user out.
      // Any other failure (network hiccup, or the request getting aborted because the user
      // navigated away before it finished — very easy to trigger by browsing quickly) is not
      // evidence the session is bad, and clearing it here would silently sign the user out.
      if (e instanceof ApiError && e.status === 401) clear();
    });
  }, [hasHydrated, token]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Protected><PageTransition><Dashboard /></PageTransition></Protected>} />
        <Route path="/browse" element={<PageTransition><Browse /></PageTransition>} />
        <Route path="/listing/:id" element={<PageTransition><ListingDetail /></PageTransition>} />
        <Route path="/checkout/:id" element={<Protected><PageTransition><Checkout /></PageTransition></Protected>} />
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
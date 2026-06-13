import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AuthPage from "./views/AuthPage";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CookieBanner from "./components/CookieBanner";
import IdleLogout from "./components/IdleLogout";
import ResidentView from "./views/ResidentView";
import StaffView from "./views/StaffView";
import MyBookings from "./views/MyBookings";
import SettingsView from "./views/SettingsView";

function AppShell() {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cookieModal, setCookieModal] = useState(false);

  // Allow reset-password page without auth
  if (location.pathname === "/reset-password") return <AuthPage initialMode="reset" />;

  if (!user) return <AuthPage />;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1000] focus:px-4 focus:py-2 focus:rounded-xl focus:font-bold focus:shadow-lg"
        style={{ background: "var(--brand)", color: "#fff" }}
      >
        Skip to main content
      </a>
      <Header userName={user.name} role={user.role} isStaff={isStaff} />
      <main id="main-content" className="pb-20">
        <Routes>
          {/* Booking flow — all render ResidentView; URL synced via replaceState in the component */}
          <Route path="/"         element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/search"   element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/results"  element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/book"     element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/hold"     element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/pay"      element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/confirmed"element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />

          <Route path="/bookings" element={<MyBookings user={user} onBack={() => navigate("/")} />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/staff"    element={isStaff ? <StaffView /> : <Navigate to="/" replace />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer cookieModalOpen={cookieModal} onCookieModalClose={() => setCookieModal(false)} />
      <CookieBanner onOpenPolicy={() => setCookieModal(true)} />
      <IdleLogout />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

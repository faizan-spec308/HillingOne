import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./views/AuthPage";
import Header from "./components/Header";
import ResidentView from "./views/ResidentView";
import StaffView from "./views/StaffView";
import MyBookings from "./views/MyBookings";

function AppShell() {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  if (!user) return <AuthPage />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={user.name} role={user.role} isStaff={isStaff} />
      <main className="pb-20">
        <Routes>
          {/* Booking flow — all render ResidentView; URL synced via replaceState in the component */}
          <Route path="/"         element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/search"   element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/results"  element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/hold"     element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/pay"      element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />
          <Route path="/confirmed"element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />} />

          <Route path="/bookings" element={<MyBookings user={user} onBack={() => navigate("/")} />} />
          <Route path="/staff"    element={isStaff ? <StaffView /> : <Navigate to="/" replace />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

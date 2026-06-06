import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
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
          <Route
            path="/"
            element={<ResidentView user={user} onViewMyBookings={() => navigate("/bookings")} />}
          />
          <Route
            path="/bookings"
            element={<MyBookings user={user} onBack={() => navigate("/")} />}
          />
          <Route
            path="/staff"
            element={isStaff ? <StaffView /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AuthProvider>
  );
}

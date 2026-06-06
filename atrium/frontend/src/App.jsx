import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./views/AuthPage";
import Header from "./components/Header";
import ResidentView from "./views/ResidentView";
import StaffView from "./views/StaffView";
import MyBookings from "./views/MyBookings";

function AppShell() {
  const { user, isStaff } = useAuth();
  const [view, setView] = useState("resident");

  if (!user) return <AuthPage />;

  const handleViewChange = (v) => {
    // Non-staff cannot access the staff view
    if (v === "staff" && !isStaff) return;
    setView(v);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        view={view}
        onViewChange={handleViewChange}
        userName={user.name}
        role={user.role}
        isStaff={isStaff}
        onMyBookings={() => setView("my-bookings")}
      />

      <main className="pb-20">
        {view === "resident"    && <ResidentView user={user} onViewMyBookings={() => setView("my-bookings")} />}
        {view === "my-bookings" && <MyBookings user={user} onBack={() => setView("resident")} />}
        {view === "staff"       && isStaff && <StaffView />}
        {view === "staff"       && !isStaff && (
          <div className="max-w-md mx-auto px-6 py-20 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-[18px] font-bold text-gray-900 mb-2">Staff access only</h2>
            <p className="text-[14px] text-gray-500">This area is restricted to Hillingdon Council staff.</p>
          </div>
        )}
      </main>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

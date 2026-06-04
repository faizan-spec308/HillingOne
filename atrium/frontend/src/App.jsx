import { useEffect, useState } from "react";
import Header from "./components/Header";
import ResidentView from "./views/ResidentView";
import StaffView from "./views/StaffView";
import MyBookings from "./views/MyBookings";
import DemoController from "./components/DemoController";
import AgentReasoningPanel from "./components/AgentReasoningPanel";
import { api } from "./api/client";

export default function App() {
  const [view, setView] = useState("resident");
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [agentRun, setAgentRun] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.demoUsers()
      .then((u) => {
        setUsers(u);
        const resident = u.find((x) => x.role === "resident") || u[0];
        setActiveUser(resident);
      })
      .catch((e) => setError(`Backend unreachable: ${e.message}. Make sure the backend is running on port 8000.`));
  }, []);

  // When the user switches to staff view, change active user to a staff user
  useEffect(() => {
    if (!users.length) return;
    if (view === "staff") {
      const staff = users.find((u) => u.role === "staff");
      if (staff) setActiveUser(staff);
    } else {
      const resident = users.find((u) => u.role === "resident");
      if (resident) setActiveUser(resident);
    }
  }, [view, users]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-red-700 font-semibold mb-2">Cannot reach backend</div>
          <div className="text-sm text-gray-600">{error}</div>
          <div className="mt-4 text-xs text-gray-500 font-mono bg-gray-100 p-3 rounded">
            docker compose up
          </div>
        </div>
      </div>
    );
  }

  if (!activeUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading Atrium...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        view={view}
        onViewChange={setView}
        userName={activeUser.name}
        role={activeUser.role}
      />

      <main className="pb-20">
        {view === "resident" && <ResidentView user={activeUser} onViewMyBookings={() => setView("my-bookings")} />}
        {view === "my-bookings" && <MyBookings user={activeUser} onBack={() => setView("resident")} />}
        {view === "staff" && <StaffView />}
      </main>

      <DemoController
        onAgentRun={(run) => setAgentRun(run)}
        onScenarioComplete={() => {}}
      />

      <AgentReasoningPanel run={agentRun} onClose={() => setAgentRun(null)} />
    </div>
  );
}

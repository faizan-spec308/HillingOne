import { useEffect, useState } from "react";
import {
  Activity, MapPin, AlertTriangle, TrendingUp,
  ShieldCheck, Clock, RefreshCw, Users, Zap,
} from "lucide-react";
import { api } from "../api/client";

export default function StaffView() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const refresh = async () => {
    try {
      const res = await api.staffDashboard();
      setData(res);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 skeleton h-96 rounded-2xl" />
          <div className="space-y-5">
            <div className="skeleton h-52 rounded-2xl" />
            <div className="skeleton h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const utilisationStyle = {
    blue:  { dot: "#3B82F6", bg: "bg-blue-50",    text: "text-blue-700",    label: "Underused" },
    green: { dot: "#10B981", bg: "bg-emerald-50",  text: "text-emerald-700", label: "Healthy" },
    amber: { dot: "#F59E0B", bg: "bg-amber-50",    text: "text-amber-700",   label: "Oversubscribed" },
  };

  const metrics = [
    {
      icon: <Activity size={20} />,
      label: "Bookings this week",
      value: data.metrics.weekly_bookings,
      accent: false,
    },
    {
      icon: <Clock size={20} />,
      label: "Staff hours saved",
      value: `${Math.round(data.metrics.estimated_staff_hours_saved)}h`,
      accent: true,
    },
    {
      icon: <TrendingUp size={20} />,
      label: "Phone calls avoided",
      value: data.metrics.phone_calls_avoided,
      accent: false,
    },
    {
      icon: <ShieldCheck size={20} />,
      label: "Interfaces replaced",
      value: data.metrics.interfaces_replaced,
      accent: false,
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 fade-in-up">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900">Staff Dashboard</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Live overview of Hillingdon Council bookings and asset utilisation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[12px] text-gray-400">
              Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={refresh}
            className="btn-secondary text-[13px] px-3 py-2"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Operating principles strip */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)" }}
      >
        <div className="text-[10px] uppercase tracking-widest text-white/60 font-bold mb-3">
          Operating principles
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1.5 gap-x-6">
          {data.principles.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-[13px] text-white/90 italic">
              <Zap size={12} className="text-white/40 flex-shrink-0 mt-[3px]" />
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Asset utilisation table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-civic">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MapPin size={16} className="text-hillingdon-navy" />
            <h3 className="font-bold text-[15px] text-gray-900">Asset utilisation</h3>
            <div className="ml-auto flex items-center gap-3">
              {Object.entries(utilisationStyle).map(([, s]) => (
                <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full staff-table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-left">Ward</th>
                  <th className="px-4 py-3 text-right">Capacity</th>
                  <th className="px-4 py-3 text-right">Bookings</th>
                  <th className="px-4 py-3 text-right">Utilisation</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.asset_utilisation.map((a) => {
                  const s = utilisationStyle[a.colour] || utilisationStyle.green;
                  const pct = a.utilisation_pct;
                  return (
                    <tr key={a.id} className="transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[13px] text-gray-900">{a.name}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500">{a.ward}</td>
                      <td className="px-4 py-3 text-right text-[13px] text-gray-700">
                        <span className="flex items-center justify-end gap-1">
                          <Users size={11} className="text-gray-400" />
                          {a.capacity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold text-gray-800">
                        {a.weekly_bookings}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: s.dot }}
                            />
                          </div>
                          <span className="text-[13px] font-bold w-10 text-right" style={{ color: s.dot }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Live agent feed */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-civic">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Activity size={15} className="text-hillingdon-navy" />
              <h3 className="font-bold text-[14px] text-gray-900">Live agent feed</h3>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-subtle" />
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Live</span>
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto">
              {data.agent_feed.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-gray-400">No recent activity</div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {data.agent_feed.map((entry) => (
                    <li key={entry.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="text-[12px] font-bold text-gray-800 uppercase tracking-wide">
                          {entry.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {new Date(entry.created_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {entry.reason && (
                        <p className="text-[12px] text-gray-500">Reason: {entry.reason}</p>
                      )}
                      {entry.ai_reasoning && (
                        <p className="text-[11px] text-gray-400 italic mt-0.5 line-clamp-2">
                          {entry.ai_reasoning}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Demand alerts */}
          {data.demand_alerts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-civic">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" />
                <h3 className="font-bold text-[14px] text-gray-900">Unmet demand</h3>
                <span className="ml-auto text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {data.demand_alerts.length} alerts
                </span>
              </div>
              <ul className="divide-y divide-gray-50">
                {data.demand_alerts.slice(0, 4).map((d, i) => (
                  <li key={i} className="px-5 py-3">
                    <p className="text-[12px] font-semibold text-gray-800 italic mb-0.5">
                      "{d.raw_query}"
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Only {d.results_count} match{d.results_count !== 1 ? "es" : ""} found
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, accent }) {
  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-200 shadow-civic ${
        accent
          ? "border-hillingdon-navy text-white"
          : "bg-white border-gray-200"
      }`}
      style={accent ? { background: "linear-gradient(135deg, #0F766E, #0D9488)" } : {}}
    >
      <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider mb-2 ${
        accent ? "text-white/70" : "text-gray-400"
      }`}>
        <span className={`p-1.5 rounded-lg ${accent ? "bg-white/15" : "bg-hillingdon-navy-tint text-hillingdon-navy"}`}>
          {icon}
        </span>
        {label}
      </div>
      <div className={`text-[32px] font-black leading-tight tracking-tight ${accent ? "text-white" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

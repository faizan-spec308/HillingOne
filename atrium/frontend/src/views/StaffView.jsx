import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../context/ThemeContext";
import {
  Activity, MapPin, AlertTriangle, TrendingUp,
  ShieldCheck, Clock, RefreshCw, Users, Zap, Download,
  Plus, Edit2, ToggleLeft, ToggleRight, X, CheckCircle2, Building2,
  Bot, ListChecks, ChevronDown, ChevronUp, Loader2, ArrowLeftRight,
} from "lucide-react";
import { api } from "../api/client";

const WARDS = [
  "Botwell","Brunel","Charville","Heathrow Villages","Hayes Town",
  "Hillingdon East","Manor","Northwood","Pinkwell","Ruislip",
  "Townfield","Uxbridge","West Drayton","Yiewsley",
];

const CATEGORIES = [
  "community_centre","meeting_room","sports_hall","library_space",
  "office","outdoor_space","studio","youth_centre","other",
];

/* ── Asset form modal ─────────────────────────────────────────────── */
function AssetModal({ asset, onClose, onSaved }) {
  const blank = { name:"", category:"community_centre", ward:"Uxbridge", capacity:20,
    hourly_rate:0, description:"", image_url:"",
    amenities:{ wifi:false, kitchen:false, parking:false },
    accessibility:{ wheelchair_access:false, hearing_loop:false } };

  const [form, setForm]     = useState(asset ? {
    ...asset,
    amenities: asset.amenities || {},
    accessibility: asset.accessibility || {},
  } : blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAmenity = (k, v) => setForm(f => ({ ...f, amenities: { ...f.amenities, [k]: v } }));
  const setAccess  = (k, v) => setForm(f => ({ ...f, accessibility: { ...f.accessibility, [k]: v } }));

  const save = async () => {
    if (!form.name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        name: form.name.trim(), category: form.category, ward: form.ward,
        capacity: Number(form.capacity), hourly_rate: Number(form.hourly_rate),
        description: form.description || null, image_url: form.image_url || null,
        amenities: form.amenities, accessibility: form.accessibility,
      };
      const saved = asset
        ? await api.staffUpdateAsset(asset.id, payload)
        : await api.staffCreateAsset(payload);
      onSaved(saved, !asset);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backdropFilter:"blur(4px)", background:"rgba(15,23,42,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[18px] font-black text-gray-900">{asset ? "Edit asset" : "Add new asset"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
          </div>
          {/* Category + Ward */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Ward</label>
              <select value={form.ward} onChange={e => set("ward", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500">
                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          {/* Capacity + Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Capacity</label>
              <input type="number" min="1" value={form.capacity} onChange={e => set("capacity", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Hourly rate (£)</label>
              <input type="number" min="0" step="0.50" value={form.hourly_rate} onChange={e => set("hourly_rate", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea rows={3} value={form.description || ""} onChange={e => set("description", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none" />
          </div>
          {/* Image URL */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Image URL (optional)</label>
            <input value={form.image_url || ""} onChange={e => set("image_url", e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
          </div>
          {/* Amenities */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Amenities</label>
            <div className="flex flex-wrap gap-3">
              {[["wifi","Wi-Fi"],["kitchen","Kitchen"],["parking","Parking"]].map(([k,label]) => (
                <label key={k} className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!form.amenities[k]} onChange={e => setAmenity(k, e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {/* Accessibility */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Accessibility</label>
            <div className="flex flex-wrap gap-3">
              {[["wheelchair_access","Wheelchair access"],["hearing_loop","Hearing loop"]].map(([k,label]) => (
                <label key={k} className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!form.accessibility[k]} onChange={e => setAccess(k, e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {err && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{err}</div>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[14px] font-semibold rounded-xl transition">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="btn-primary flex-1 justify-center text-[14px]">
              {saving ? "Saving…" : asset ? "Save changes" : "Create asset"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Asset management panel ───────────────────────────────────────── */
function AssetManagement() {
  const [assets, setAssets]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);   // asset or null
  const [adding, setAdding]     = useState(false);
  const [toast, setToast]       = useState(null);

  useEffect(() => {
    api.staffListAssets().then(setAssets).finally(() => setLoading(false));
  }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaved = (saved, isNew) => {
    if (isNew) setAssets(prev => [saved, ...prev]);
    else setAssets(prev => prev.map(a => a.id === saved.id ? saved : a));
    setEditing(null); setAdding(false);
    showToast(isNew ? `${saved.name} created.` : `${saved.name} updated.`);
  };

  const handleToggle = async (asset) => {
    try {
      const updated = await api.staffToggleAsset(asset.id);
      setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast(`${updated.name} ${updated.is_active ? "activated" : "deactivated"}.`);
    } catch (e) { showToast(e.message, false); }
  };

  return (
    <div>
      {(adding || editing) && (
        <AssetModal
          asset={editing}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={handleSaved}
        />
      )}

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-[13px] font-semibold ${toast.ok ? "bg-white border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {toast.ok ? <CheckCircle2 size={15} className="text-emerald-500" /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-gray-500">{assets.length} assets total</p>
        <button onClick={() => setAdding(true)} className="btn-primary text-[13px] px-4 py-2">
          <Plus size={14} /> Add asset
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Ward</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-right">Cap.</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-right">Rate</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {assets.map(a => (
                <tr key={a.id} className={`transition-colors hover:bg-gray-50 ${!a.is_active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 text-[13px] font-semibold text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-500">{a.ward}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-500">{a.category.replace(/_/g," ")}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700 text-right">{a.capacity}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700 text-right">
                    {a.hourly_rate === 0 ? <span className="text-emerald-600 font-semibold">Free</span> : `£${a.hourly_rate.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${a.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(a)}
                        className="p-1.5 text-gray-400 hover:text-hillingdon-navy hover:bg-blue-50 rounded-lg transition">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleToggle(a)}
                        className={`p-1.5 rounded-lg transition ${a.is_active ? "text-gray-400 hover:text-red-500 hover:bg-red-50" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"}`}>
                        {a.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Decision Queue ───────────────────────────────────────────────── */
function DecisionQueue() {
  const [queue, setQueue]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [agentState, setAgentState] = useState({}); // { [bookingId]: { running, result, error } }

  const load = async () => {
    try {
      const data = await api.decisionQueue();
      setQueue(data);
    } catch (e) {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAccept = async (bookingId) => {
    try {
      await api.acceptSwap(bookingId);
      setQueue(q => q.filter(r => r.booking.id !== bookingId));
    } catch (e) { alert(e.message); }
  };

  const handleDecline = async (bookingId) => {
    try {
      await api.declineSwap(bookingId);
      setQueue(q => q.filter(r => r.booking.id !== bookingId));
    } catch (e) { alert(e.message); }
  };

  const handleRunAgent = async (row) => {
    const id = row.booking.id;
    setAgentState(s => ({ ...s, [id]: { running: true } }));
    try {
      const result = await api.triggerAgent({
        confirmed_booking_id: id,
        priority_request_summary: `Staff requested conflict resolution for booking ${row.booking.reference}`,
      });
      setAgentState(s => ({ ...s, [id]: { running: false, result } }));
    } catch (e) {
      setAgentState(s => ({ ...s, [id]: { running: false, error: e.message } }));
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>;

  if (!queue?.length) return (
    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
      <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
      <p className="text-[15px] font-bold text-gray-700">All clear</p>
      <p className="text-[13px] text-gray-400 mt-1">No pending swap decisions. The AI is on top of it.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-gray-500">{queue.length} pending decision{queue.length !== 1 ? "s" : ""}</p>
      {queue.map(row => {
        const b = row.booking;
        const a = row.asset;
        const alt = row.alternative;
        const state = agentState[b.id] || {};
        return (
          <div key={b.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-civic">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Swap pending
                  </span>
                  <span className="text-[12px] font-mono text-gray-400">{b.reference}</span>
                </div>
                <p className="text-[14px] font-bold text-gray-900">{a?.name || "Unknown asset"}</p>
                <p className="text-[12px] text-gray-500">{a?.ward} · {b.start_time ? new Date(b.start_time).toLocaleString("en-GB", { dateStyle:"medium", timeStyle:"short" }) : "—"}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleAccept(b.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg transition"
                >
                  Accept swap
                </button>
                <button
                  onClick={() => handleDecline(b.id)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-bold rounded-lg transition"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleRunAgent(row)}
                  disabled={state.running}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-hillingdon-navy hover:opacity-90 text-white text-[12px] font-bold rounded-lg transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #0F766E, #0D9488)" }}
                >
                  {state.running ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                  Run AI agent
                </button>
              </div>
            </div>

            {alt && (
              <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-[12px] text-blue-700">
                <ArrowLeftRight size={13} className="flex-shrink-0" />
                Alternative offered: <span className="font-bold">{alt.name}</span> ({alt.ward})
              </div>
            )}

            {state.result && (
              <div className="px-5 py-4 bg-teal-50 border-t border-teal-100">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={14} className="text-teal-700" />
                  <span className="text-[12px] font-bold text-teal-700 uppercase tracking-wide">
                    Agent result — {state.result.final_decision || "done"}
                  </span>
                  <span className="text-[11px] text-teal-500">{state.result.iterations_used} tool call{state.result.iterations_used !== 1 ? "s" : ""}</span>
                </div>
                <p className="text-[13px] text-teal-800 leading-relaxed">{state.result.goal_summary}</p>
                {state.result.steps?.filter(s => s.type === "tool_call").length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {state.result.steps.filter(s => s.type === "tool_call").map((step, i) => (
                      <li key={i} className="text-[11px] text-teal-600 flex items-start gap-1.5">
                        <span className="text-teal-400 font-mono">{i + 1}.</span>
                        <span className="font-semibold">{step.tool}</span>
                        <span className="text-teal-500 truncate">{step.args ? Object.values(step.args).join(", ").slice(0, 60) : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {state.error && (
              <div className="px-5 py-3 bg-red-50 border-t border-red-100 text-[13px] text-red-700">{state.error}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Agent Runs Panel ─────────────────────────────────────────────── */
function AgentRunsPanel() {
  const [runs, setRuns]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.recentAgentRuns().then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false));
  }, []);

  const statusStyle = {
    resolved:  { bg: "bg-emerald-50",  text: "text-emerald-700",  label: "Resolved" },
    escalated: { bg: "bg-amber-50",    text: "text-amber-700",    label: "Escalated" },
    failed:    { bg: "bg-red-50",      text: "text-red-700",      label: "Failed" },
  };

  if (loading) return <div className="space-y-2">{[1,2].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>;
  if (!runs?.length) return (
    <div className="p-6 text-center text-[13px] text-gray-400">No agent runs yet</div>
  );

  return (
    <ul className="divide-y divide-gray-50">
      {runs.map(run => {
        const s = statusStyle[run.status] || statusStyle.failed;
        const isOpen = expanded === run.id;
        return (
          <li key={run.id}>
            <button
              onClick={() => setExpanded(isOpen ? null : run.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-left"
            >
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                {s.label}
              </span>
              <span className="flex-1 text-[12px] text-gray-700 truncate">{run.summary || `Run ${run.id.slice(0, 8)}`}</span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">
                {new Date(run.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {isOpen ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
            </button>
            {isOpen && run.steps?.length > 0 && (
              <div className="px-4 pb-3 bg-gray-50">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">{run.iterations} tool call{run.iterations !== 1 ? "s" : ""}</p>
                <ul className="space-y-1">
                  {run.steps.filter(s => s.type === "tool_call").map((step, i) => (
                    <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                      <span className="text-gray-400 font-mono w-4 flex-shrink-0">{i + 1}.</span>
                      <span className="font-semibold text-teal-700">{step.tool}</span>
                      <span className="text-gray-500 truncate">{step.args ? Object.values(step.args).slice(0,2).join(", ") : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ── Booking trend bar chart ──────────────────────────────────────── */
function BookingTrendChart({ assets, isDark }) {
  if (!assets || assets.length === 0) return null;

  const top = [...assets].sort((a, b) => b.weekly_bookings - a.weekly_bookings).slice(0, 6);
  const maxVal = Math.max(...top.map(a => a.weekly_bookings), 1);

  const BAR_H = 140;
  const BAR_W = 36;
  const GAP   = 14;
  const LEFT  = 28;
  const svgW  = LEFT + top.length * (BAR_W + GAP);
  const svgH  = BAR_H + 36;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: "visible" }}>
      {/* Grid lines */}
      {gridLines.map((f) => {
        const y = Math.round(BAR_H * (1 - f));
        return (
          <g key={f}>
            <line x1={LEFT} y1={y} x2={svgW} y2={y}
              stroke={isDark ? "#21262D" : "#F3F4F6"} strokeWidth="1" />
            <text x={LEFT - 4} y={y + 4} textAnchor="end"
              fontSize="9" fill={isDark ? "#484F58" : "#9CA3AF"}>
              {Math.round(f * maxVal)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {top.map((asset, i) => {
        const x = LEFT + i * (BAR_W + GAP);
        const barH = Math.max(4, Math.round((asset.weekly_bookings / maxVal) * BAR_H));
        const y = BAR_H - barH;
        const isTop = i === 0;

        return (
          <g key={asset.id}>
            <rect
              x={x} y={y} width={BAR_W} height={barH}
              rx="5" ry="5"
              fill={isTop
                ? "url(#topGrad)"
                : (isDark ? "#21262D" : "#F3F4F6")}
            />
            <text x={x + BAR_W / 2} y={y - 5} textAnchor="middle"
              fontSize="10" fontWeight="700"
              fill={isTop ? "#0D9488" : (isDark ? "#8B949E" : "#6B7280")}>
              {asset.weekly_bookings}
            </text>
            <text x={x + BAR_W / 2} y={BAR_H + 14} textAnchor="middle"
              fontSize="9" fill={isDark ? "#8B949E" : "#6B7280"}>
              {asset.name.length > 8 ? asset.name.slice(0, 8) + "…" : asset.name}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function StaffView() {
  const { isDark } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  const card  = isDark ? { background: "#161B22", border: "1px solid #30363D" } : {};
  const surf  = isDark ? { background: "#0E1117" } : {};
  const text1 = isDark ? "#E6EDF3" : "#111827";
  const text2 = isDark ? "#8B949E" : "#6B7280";
  const divider = isDark ? "#21262D" : "#F3F4F6";

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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-bold" style={{ color: text1 }}>Staff Portal</h2>
          <p className="text-[13px] mt-0.5" style={{ color: text2 }}>
            Hillingdon Council — live bookings, assets and utilisation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "dashboard" && lastRefresh && (
            <span className="text-[12px] text-gray-400">
              Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {activeTab === "dashboard" && (
            <>
              <button onClick={() => api.downloadBookingsCsv()} className="btn-secondary text-[13px] px-3 py-2">
                <Download size={13} />
                Export CSV
              </button>
              <button onClick={refresh} className="btn-secondary text-[13px] px-3 py-2">
                <RefreshCw size={13} />
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto" style={{ borderBottom: `1px solid ${isDark ? "#30363D" : "#E5E7EB"}` }}>
        {[
          { id: "dashboard",       label: "Dashboard",       icon: <Activity size={14} /> },
          { id: "decision-queue",  label: "Decision Queue",  icon: <ListChecks size={14} />, badge: data?.pending_swap_responses?.length || 0 },
          { id: "agent-runs",      label: "AI Agent Runs",   icon: <Bot size={14} /> },
          { id: "assets",          label: "Manage Assets",   icon: <Building2 size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={activeTab !== tab.id ? { color: text2 } : {}}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-teal-600 text-teal-600"
                : "border-transparent hover:text-gray-800"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Manage Assets tab */}
      {activeTab === "assets" && <AssetManagement />}

      {/* Decision Queue tab */}
      {activeTab === "decision-queue" && <DecisionQueue />}

      {/* Agent Runs tab */}
      {activeTab === "agent-runs" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-civic">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Bot size={15} className="text-teal-600" />
            <h3 className="font-bold text-[15px] text-gray-900">Recent AI Agent Runs</h3>
            <span className="ml-auto text-[11px] text-gray-400">Conflict Resolution Agent · Gemini 2.5 Flash</span>
          </div>
          <AgentRunsPanel />
        </div>
      )}

      {/* Dashboard tab content below — hidden when on assets tab */}
      {activeTab === "dashboard" && (<>

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
          <MetricCard key={m.label} {...m} isDark={isDark} />
        ))}
      </div>

      {/* Bookings by venue chart */}
      {data.asset_utilisation.some(a => a.weekly_bookings > 0) && (
        <div className="rounded-2xl overflow-hidden shadow-civic mb-6" style={{ ...card, border: isDark ? "1px solid #30363D" : "1px solid #E5E7EB" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
            <TrendingUp size={15} className="text-teal-600" />
            <h3 className="font-bold text-[14px]" style={{ color: text1 }}>Weekly bookings by venue</h3>
            <span className="ml-auto text-[11px]" style={{ color: text2 }}>This week</span>
          </div>
          <div className="px-5 py-5">
            <BookingTrendChart assets={data.asset_utilisation} isDark={isDark} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Asset utilisation table */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden shadow-civic" style={{ ...card, border: isDark ? "1px solid #30363D" : "1px solid #E5E7EB" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
            <MapPin size={16} className="text-teal-600" />
            <h3 className="font-bold text-[15px]" style={{ color: text1 }}>Asset utilisation</h3>
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
                <tr style={{ borderBottom: `1px solid ${divider}` }}>
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color: text2 }}>Asset</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color: text2 }}>Ward</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide" style={{ color: text2 }}>Cap.</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide" style={{ color: text2 }}>Bookings</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide" style={{ color: text2 }}>Utilisation</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color: text2 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.asset_utilisation.map((a) => {
                  const s = utilisationStyle[a.colour] || utilisationStyle.green;
                  const pct = a.utilisation_pct;
                  return (
                    <tr key={a.id} className="transition-colors" style={{ borderBottom: `1px solid ${divider}` }}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[13px]" style={{ color: text1 }}>{a.name}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: text2 }}>{a.ward}</td>
                      <td className="px-4 py-3 text-right text-[13px]" style={{ color: text2 }}>
                        <span className="flex items-center justify-end gap-1">
                          <Users size={11} />
                          {a.capacity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold" style={{ color: text1 }}>
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
          <div className="rounded-2xl overflow-hidden shadow-civic" style={{ ...card, border: isDark ? "1px solid #30363D" : "1px solid #E5E7EB" }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
              <Activity size={15} className="text-teal-600" />
              <h3 className="font-bold text-[14px]" style={{ color: text1 }}>Live agent feed</h3>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-subtle" />
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Live</span>
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto">
              {data.agent_feed.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-gray-400">No recent activity</div>
              ) : (
                <ul>
                  {data.agent_feed.map((entry) => (
                    <li key={entry.id} className="px-4 py-3 transition-colors" style={{ borderBottom: `1px solid ${divider}` }}>
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: text1 }}>
                          {entry.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] flex-shrink-0" style={{ color: text2 }}>
                          {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {entry.reason && (
                        <p className="text-[12px]" style={{ color: text2 }}>Reason: {entry.reason}</p>
                      )}
                      {entry.ai_reasoning && (
                        <p className="text-[11px] italic mt-0.5 line-clamp-2" style={{ color: text2 }}>
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
            <div className="rounded-2xl overflow-hidden shadow-civic" style={{ ...card, border: isDark ? "1px solid #30363D" : "1px solid #E5E7EB" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
                <AlertTriangle size={15} className="text-amber-500" />
                <h3 className="font-bold text-[14px]" style={{ color: text1 }}>Unmet demand</h3>
                <span className="ml-auto text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {data.demand_alerts.length} alerts
                </span>
              </div>
              <ul>
                {data.demand_alerts.slice(0, 4).map((d, i) => (
                  <li key={i} className="px-5 py-3" style={{ borderBottom: `1px solid ${divider}` }}>
                    <p className="text-[12px] font-semibold italic mb-0.5" style={{ color: text1 }}>
                      "{d.raw_query}"
                    </p>
                    <p className="text-[11px]" style={{ color: text2 }}>
                      Only {d.results_count} match{d.results_count !== 1 ? "es" : ""} found
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent agent runs */}
          {data.recent_agent_runs?.length > 0 && (
            <div className="rounded-2xl overflow-hidden shadow-civic" style={{ ...card, border: isDark ? "1px solid #30363D" : "1px solid #E5E7EB" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
                <Bot size={15} className="text-teal-600" />
                <h3 className="font-bold text-[14px] text-gray-900">AI Agent</h3>
                <button
                  onClick={() => setActiveTab("agent-runs")}
                  className="ml-auto text-[11px] text-teal-600 hover:underline font-medium"
                >
                  View all
                </button>
              </div>
              <ul>
                {data.recent_agent_runs.slice(0, 3).map(run => {
                  const statusColour = run.status === "resolved" ? "text-emerald-600 bg-emerald-50" :
                                       run.status === "escalated" ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
                  return (
                    <li key={run.id} className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${divider}` }}>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${statusColour}`}>
                        {run.status}
                      </span>
                      <span className="flex-1 text-[12px] truncate" style={{ color: text2 }}>{run.summary || `Run ${run.id.slice(0,8)}`}</span>
                      <span className="text-[11px]" style={{ color: text2 }}>{run.iterations} calls</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </div>
      </div>
      </>)}
    </div>
  );
}

function MetricCard({ icon, label, value, accent, isDark }) {
  if (accent) {
    return (
      <div className="p-5 rounded-2xl shadow-civic" style={{ background: "linear-gradient(135deg, #0F766E, #0D9488)" }}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider mb-2 text-white/70">
          <span className="p-1.5 rounded-lg bg-white/15">{icon}</span>
          {label}
        </div>
        <div className="text-[32px] font-black leading-tight tracking-tight text-white">{value}</div>
      </div>
    );
  }
  return (
    <div
      className="p-5 rounded-2xl shadow-civic"
      style={{
        background: isDark ? "#161B22" : "#ffffff",
        border: `1px solid ${isDark ? "#30363D" : "#E5E7EB"}`,
      }}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}>
        <span className="p-1.5 rounded-lg" style={{ background: isDark ? "#21262D" : "#F0FDF4", color: "#0D9488" }}>{icon}</span>
        {label}
      </div>
      <div className="text-[32px] font-black leading-tight tracking-tight" style={{ color: isDark ? "#E6EDF3" : "#111827" }}>{value}</div>
    </div>
  );
}
